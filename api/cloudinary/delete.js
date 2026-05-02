const crypto = require('crypto');
const { rateLimit, requireAuth, safeError } = require('../_lib/security');

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;

function sign(params, secret) {
  // Cloudinary signature: SHA-1 of "key1=val1&key2=val2&...{secret}"
  const sorted = Object.keys(params).sort().map(k => `${k}=${params[k]}`).join('&');
  return crypto.createHash('sha1').update(sorted + secret).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (rateLimit(req, res)) return;
  if (await requireAuth(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!CLOUD || !KEY || !SECRET) return res.status(500).json({ error: 'Cloudinary env vars not set (CLOUDINARY_CLOUD_NAME / CLOUDINARY_API_KEY / CLOUDINARY_API_SECRET)' });

  try {
    const { public_id, resource_type } = req.body || {};
    if (!public_id) return res.status(400).json({ error: 'public_id is required' });
    const rt = resource_type === 'video' ? 'video' : 'image';
    const timestamp = Math.floor(Date.now() / 1000);
    const params = { public_id, timestamp };
    const signature = sign(params, SECRET);
    const url = `https://api.cloudinary.com/v1_1/${CLOUD}/${rt}/destroy`;
    const form = new URLSearchParams({
      public_id, timestamp: String(timestamp), api_key: KEY, signature,
    });
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const data = await r.json();
    if (data.result !== 'ok' && data.result !== 'not found') {
      return res.status(502).json({ error: 'Cloudinary refused delete', cloudinary: data });
    }
    return res.json({ ok: true, result: data.result });
  } catch (err) {
    safeError(res, 'Failed to delete asset', err);
  }
};
