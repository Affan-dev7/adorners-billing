const { Redis } = require('@upstash/redis');
const { put, list, del } = require('@vercel/blob');

// A daily snapshot of the live document list, kept as a separate, cold-storage
// copy. Redis is the live data (fast, consistent, but one copy); this backup
// exists purely so a bug or accident has a recent, restorable fallback.
//
// It writes to two independent providers (Vercel Blob and a GitHub repo) so a
// single provider's outage or account issue can't take out both the live data
// and its backups at once.
const REDIS_KEY = 'adorners_documents';
const RETENTION_DAYS = 30;

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

async function pushToGitHub(path, jsonContent) {
  const repo = process.env.GITHUB_BACKUP_REPO;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return { skipped: true };

  const apiUrl = `https://api.github.com/repos/${repo}/contents/${path}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  const existing = await fetch(apiUrl, { headers });
  const sha = existing.ok ? (await existing.json()).sha : undefined;

  const res = await fetch(apiUrl, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: `Backup ${path}`,
      content: Buffer.from(jsonContent).toString('base64'),
      ...(sha ? { sha } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub backup failed (${res.status}): ${body}`);
  }
  return { skipped: false };
}

module.exports = async function handler(req, res) {
  // Only Vercel's own cron scheduler (which sends this exact header) may
  // trigger a backup run — never a random visitor hitting the URL.
  const authHeader = req.headers.authorization || '';
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    res.status(401).json({ error: 'Not authorized' });
    return;
  }

  try {
    const docs = (await redis.get(REDIS_KEY)) || [];
    const stamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    const path = `backups/${stamp}.json`;

    const content = JSON.stringify(docs, null, 2);

    await put(path, content, {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Prune backups older than the retention window so this doesn't grow forever.
    // GitHub history is kept indefinitely (git storage is cheap and it's the
    // long-term durable copy), so pruning only applies to Vercel Blob.
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const { blobs } = await list({ prefix: 'backups/', token: process.env.BLOB_READ_WRITE_TOKEN });
    const stale = blobs.filter(b => new Date(b.uploadedAt).getTime() < cutoff).map(b => b.url);
    if (stale.length) {
      await del(stale, { token: process.env.BLOB_READ_WRITE_TOKEN });
    }

    const github = await pushToGitHub(path, content);

    res.status(200).json({
      ok: true,
      backedUpDocuments: docs.length,
      path,
      pruned: stale.length,
      github: github.skipped ? 'skipped (not configured)' : 'pushed',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
