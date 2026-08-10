const { Redis } = require('@upstash/redis');
const { put, list, del } = require('@vercel/blob');

// A daily snapshot of the live document list, kept as a separate, cold-storage
// copy. Redis is the live data (fast, consistent, but one copy); this backup
// exists purely so a bug or accident has a recent, restorable fallback.
const REDIS_KEY = 'adorners_documents';
const RETENTION_DAYS = 30;

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

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

    await put(path, JSON.stringify(docs, null, 2), {
      access: 'public',
      addRandomSuffix: false,
      allowOverwrite: true,
      contentType: 'application/json',
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    // Prune backups older than the retention window so this doesn't grow forever.
    const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
    const { blobs } = await list({ prefix: 'backups/', token: process.env.BLOB_READ_WRITE_TOKEN });
    const stale = blobs.filter(b => new Date(b.uploadedAt).getTime() < cutoff).map(b => b.url);
    if (stale.length) {
      await del(stale, { token: process.env.BLOB_READ_WRITE_TOKEN });
    }

    res.status(200).json({ ok: true, backedUpDocuments: docs.length, path, pruned: stale.length });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
