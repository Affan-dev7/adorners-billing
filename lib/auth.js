// Shared password gate. One HMAC-signed session cookie, no accounts/database —
// matches how the business actually operates (whoever has the password is in).
const crypto = require('crypto');

const MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000; // 90 days, so re-login is rare on a phone

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error('SESSION_SECRET environment variable is not set');
  return s;
}

function sign(payload) {
  const b64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', secret()).update(b64).digest('base64url');
  return `${b64}.${sig}`;
}

function verify(token) {
  if (!token) return false;
  const [b64, sig] = token.split('.');
  if (!b64 || !sig) return false;
  const expected = crypto.createHmac('sha256', secret()).update(b64).digest('base64url');
  if (sig !== expected) return false;
  try {
    const payload = JSON.parse(Buffer.from(b64, 'base64url').toString());
    return typeof payload.exp === 'number' && Date.now() < payload.exp;
  } catch {
    return false;
  }
}

function makeSessionCookie() {
  const token = sign({ exp: Date.now() + MAX_AGE_MS });
  return `session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${Math.floor(MAX_AGE_MS / 1000)}`;
}

function isAuthorized(req) {
  const header = req.headers.cookie || '';
  const match = header.match(/(?:^|;\s*)session=([^;]+)/);
  return match ? verify(match[1]) : false;
}

module.exports = { makeSessionCookie, isAuthorized };
