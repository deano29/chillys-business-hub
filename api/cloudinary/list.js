const { rateLimit, requireAuth, safeError } = require('../_lib/security');

const CLOUD = process.env.CLOUDINARY_CLOUD_NAME;
const KEY = process.env.CLOUDINARY_API_KEY;
const SECRET = process.env.CLOUDINARY_API_SECRET;

// Lists ALL media in the Cloudinary account using authenticated Admin API.
// Independent of tags or public Resource List settings, so it just works.

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (rateLimit(req, res)) return;
  if (await requireAuth(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  if (!CLOUD || !KEY || !SECRET) {
    return res.status(503).json({ error: 'Cloudinary env vars not set', missing: { cloud: !CLOUD, key: !KEY, secret: !SECRET } });
  }

  try {
    const auth = 'Basic ' + Buffer.from(`${KEY}:${SECRET}`).toString('base64');
    async function fetchType(resource_type) {
      const url = `https://api.cloudinary.com/v1_1/${CLOUD}/resources/${resource_type}?max_results=500`;
      const r = await fetch(url, { headers: { Authorization: auth } });
      if (!r.ok) throw new Error(`${resource_type} list returned ${r.status}`);
      const data = await r.json();
      return (data.resources || []).map(it => ({
        public_id: it.public_id,
        format: it.format,
        version: it.version,
        resource_type: resource_type,
        type: it.type,
        created_at: it.created_at,
        bytes: it.bytes,
        width: it.width,
        height: it.height,
        tags: it.tags || [],
        url: it.secure_url || it.url,
      }));
    }
    const [images, videos] = await Promise.all([
      fetchType('image').catch(e => { console.warn(e.message); return []; }),
      fetchType('video').catch(e => { console.warn(e.message); return []; }),
    ]);
    const merged = [...images, ...videos].sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    return res.json({ resources: merged });
  } catch (err) {
    safeError(res, 'Failed to list Cloudinary assets', err);
  }
};
