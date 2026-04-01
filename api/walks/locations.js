const https = require('https');
const { URL } = require('url');

function fetchURL(url) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; Google-Calendar-Importer)',
        'Accept': 'text/calendar, text/plain, */*',
      },
    };
    https.get(options, (resp) => {
      if (resp.statusCode >= 300 && resp.statusCode < 400 && resp.headers.location) {
        return fetchURL(resp.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function geocodeAddress(addr) {
  return new Promise((resolve, reject) => {
    const q = encodeURIComponent(addr + ', VIC, Australia');
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=au&limit=1`;
    const parsed = new URL(url);
    https.get({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      headers: { 'User-Agent': 'ChillysBusinessHub/1.0', 'Accept': 'application/json' },
    }, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.length) resolve({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
          else resolve(null);
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const calUrl = process.env.TTP_CALENDAR_URL;
  if (!calUrl) return res.status(500).json({ error: 'TTP_CALENDAR_URL not configured' });

  try {
    const icsText = await fetchURL(calUrl);
    const events = parseICS(icsText);
    const now = new Date();

    // Build unique client locations from walks
    const clientMap = {};
    events.forEach(e => {
      if (!e.client || e.client === 'Potential Client (general)') return;
      if (!e.location) return;
      if (!clientMap[e.client]) {
        clientMap[e.client] = { locations: new Set(), services: new Set(), futureWalks: 0, pastWalks: 0 };
      }
      clientMap[e.client].locations.add(e.location);
      if (e.service) clientMap[e.client].services.add(e.service);
      if (new Date(e.start) > now) clientMap[e.client].futureWalks++;
      else clientMap[e.client].pastWalks++;
    });

    // Geocode unique addresses (with caching in response)
    const locations = [];
    const geocodeCache = {};
    const entries = Object.entries(clientMap);

    for (const [name, data] of entries) {
      const addr = [...data.locations][0]; // Use first/primary address
      if (!addr) continue;

      let coords = geocodeCache[addr];
      if (!coords) {
        coords = await geocodeAddress(addr);
        if (coords) geocodeCache[addr] = coords;
        // Rate limit: small delay between geocode requests
        await new Promise(r => setTimeout(r, 200));
      }

      if (coords) {
        const status = data.futureWalks > 0 ? 'active' : 'inactive';
        // Extract suburb from address
        const parts = addr.split(',').map(s => s.trim());
        const suburb = parts.length >= 2 ? parts[1].replace(/\s*(VIC|Victoria|AU-VIC)\s*/gi, '').trim() : parts[0];

        locations.push({
          refId: 'ttp_' + name.replace(/\s+/g, '_'),
          refType: 'client',
          name: name.replace(/\\+$/g, ''),
          status,
          suburb,
          addr,
          lat: coords.lat,
          lng: coords.lng,
          service: [...data.services][0] || '',
          futureWalks: data.futureWalks,
          pastWalks: data.pastWalks,
        });
      }
    }

    res.json(locations);
  } catch (err) {
    console.error('Locations error:', err.message);
    res.status(500).json({ error: err.message });
  }
};

function parseICS(text) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const event = {};
    const unfolded = block.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([A-Z\-;]+?)[:;](.+)/);
      if (!match) continue;
      const key = match[1].split(';')[0];
      let val = match[2];
      if (line.includes('TZID=')) val = val.split(':').pop();
      if (key === 'SUMMARY') event.summary = val;
      if (key === 'LOCATION') event.location = (val || '').replace(/\\n/g, ', ').replace(/\\,/g, ',');
      if (key === 'DTSTART') event.dtstart = val;
      if (key === 'DTEND') event.dtend = val;
    }
    if (event.summary && event.dtstart) {
      const start = parseICSDate(event.dtstart);
      const parts = (event.summary || '').replace(/\\+$/g, '').split(',').map(s => s.trim().replace(/\\+$/g, ''));
      events.push({
        client: parts[0] || '',
        service: parts.slice(2).join(', ').trim() || '',
        location: event.location || '',
        start: start ? start.toISOString() : '',
      });
    }
  }
  return events;
}

function parseICSDate(str) {
  if (!str) return null;
  const clean = str.replace(/[^0-9TZ]/g, '');
  if (clean.length >= 15) {
    const y = clean.substr(0, 4), m = clean.substr(4, 2), d = clean.substr(6, 2);
    const h = clean.substr(9, 2), min = clean.substr(11, 2), s = clean.substr(13, 2);
    if (clean.endsWith('Z')) return new Date(Date.UTC(+y, +m - 1, +d, +h, +min, +s));
    return new Date(+y, +m - 1, +d, +h, +min, +s);
  }
  return new Date(str);
}
