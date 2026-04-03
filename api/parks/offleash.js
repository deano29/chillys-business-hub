const https = require('https');

// In-memory cache (refreshes on cold start, ~24h on Vercel)
let cache = null;
let cacheTime = 0;
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

function fetchOverpass(query) {
  return new Promise((resolve, reject) => {
    const postData = 'data=' + encodeURIComponent(query);
    const options = {
      hostname: 'overpass-api.de',
      path: '/api/interpreter',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        'User-Agent': 'ChillysBusinessHub/1.0',
      },
    };
    const req = https.request(options, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch { reject(new Error('Invalid JSON from Overpass')); }
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  // Return cached data if fresh
  if (cache && Date.now() - cacheTime < CACHE_TTL) {
    res.setHeader('X-Cache', 'HIT');
    return res.json(cache);
  }

  try {
    // Query Melbourne area for dog parks (wider bbox covering greater Melbourne)
    const query = `
      [out:json][timeout:30];
      (
        node["leisure"="dog_park"](-38.5,144.4,-37.4,145.8);
        way["leisure"="dog_park"](-38.5,144.4,-37.4,145.8);
        node["dog"="designated"]["leisure"="park"](-38.5,144.4,-37.4,145.8);
        way["dog"="designated"]["leisure"="park"](-38.5,144.4,-37.4,145.8);
        node["dog"="yes"]["leisure"="park"](-38.5,144.4,-37.4,145.8);
      );
      out body;>;out skel qt;
    `;

    const data = await fetchOverpass(query);

    // Process nodes and ways into simplified park objects
    const nodeMap = {};
    const parks = [];

    // First pass: index all nodes by ID (for way centroids)
    (data.elements || []).forEach(el => {
      if (el.type === 'node') nodeMap[el.id] = { lat: el.lat, lng: el.lon };
    });

    // Second pass: extract parks
    (data.elements || []).forEach(el => {
      if (el.type === 'node' && el.tags) {
        const name = el.tags.name || el.tags['name:en'] || 'Off-Leash Area';
        parks.push({
          id: 'n' + el.id,
          name,
          lat: el.lat,
          lng: el.lon,
          suburb: el.tags['addr:suburb'] || el.tags['addr:city'] || '',
          type: el.tags.leisure === 'dog_park' ? 'dog_park' : 'off_leash',
          fenced: el.tags.fenced === 'yes',
          access: el.tags.access || 'yes',
          surface: el.tags.surface || '',
          note: el.tags.note || el.tags.description || '',
        });
      }
      if (el.type === 'way' && el.tags && el.nodes) {
        // Calculate centroid from way nodes
        let latSum = 0, lngSum = 0, count = 0;
        el.nodes.forEach(nid => {
          const n = nodeMap[nid];
          if (n) { latSum += n.lat; lngSum += n.lng; count++; }
        });
        if (count > 0) {
          const name = el.tags.name || el.tags['name:en'] || 'Off-Leash Area';
          parks.push({
            id: 'w' + el.id,
            name,
            lat: latSum / count,
            lng: lngSum / count,
            suburb: el.tags['addr:suburb'] || el.tags['addr:city'] || '',
            type: el.tags.leisure === 'dog_park' ? 'dog_park' : 'off_leash',
            fenced: el.tags.fenced === 'yes',
            access: el.tags.access || 'yes',
            surface: el.tags.surface || '',
            note: el.tags.note || el.tags.description || '',
          });
        }
      }
    });

    // Deduplicate by proximity (within 50m)
    const deduped = [];
    parks.forEach(p => {
      const dup = deduped.find(d => Math.abs(d.lat - p.lat) < 0.0005 && Math.abs(d.lng - p.lng) < 0.0005);
      if (!dup) deduped.push(p);
      else if (p.name !== 'Off-Leash Area' && dup.name === 'Off-Leash Area') {
        // Prefer named parks
        dup.name = p.name;
        dup.fenced = dup.fenced || p.fenced;
      }
    });

    cache = deduped;
    cacheTime = Date.now();

    res.setHeader('X-Cache', 'MISS');
    res.json(deduped);
  } catch (err) {
    console.error('Off-leash parks error:', err.message);
    res.status(500).json({ error: 'Failed to fetch park data' });
  }
};
