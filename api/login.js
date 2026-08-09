const { makeSessionCookie } = require('../lib/auth');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }
  if (!process.env.APP_USERNAME || !process.env.APP_PASSWORD) {
    res.status(500).json({ error: 'APP_USERNAME/APP_PASSWORD are not configured on the server' });
    return;
  }

  const { username, password } = req.body || {};
  const validUsername = typeof username === 'string' && username === process.env.APP_USERNAME;
  const validPassword = typeof password === 'string' && password === process.env.APP_PASSWORD;
  if (validUsername && validPassword) {
    res.setHeader('Set-Cookie', makeSessionCookie());
    res.status(200).json({ ok: true });
  } else {
    res.status(401).json({ error: 'Wrong username or password' });
  }
};
