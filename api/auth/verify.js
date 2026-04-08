module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { password } = req.body || {};
  const correct = process.env.APP_PASSWORD;

  if (!correct) {
    // No password set — allow access
    return res.json({ ok: true });
  }

  if (password === correct) {
    return res.json({ ok: true });
  }

  return res.status(401).json({ ok: false, error: 'Wrong password' });
};
