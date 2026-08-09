const { Redis } = require('@upstash/redis');
const { isAuthorized } = require('../lib/auth');

// All documents live as one JSON value under one Redis key — mirrors the
// original localStorage design (one key holding the whole array), just moved
// server-side so every device reads/writes the same copy. Redis gives real
// read-after-write consistency, unlike the CDN-backed blob storage tried first
// (which could serve a stale copy moments after a write from another device).
const REDIS_KEY = 'adorners_documents';

const redis = new Redis({
  url: process.env.KV_REST_API_URL,
  token: process.env.KV_REST_API_TOKEN,
});

module.exports = async function handler(req, res) {
  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Not authorized' });
    return;
  }

  if (req.method === 'GET') {
    try {
      const docs = await redis.get(REDIS_KEY);
      res.status(200).json(docs || []);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    try {
      const docs = req.body;
      if (!Array.isArray(docs)) {
        res.status(400).json({ error: 'Expected an array of documents' });
        return;
      }
      await redis.set(REDIS_KEY, docs);
      res.status(200).json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
};
