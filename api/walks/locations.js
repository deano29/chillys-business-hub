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

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const calUrl = process.env.TTP_CALENDAR_URL;
  if (!calUrl) return res.status(500).json({ error: 'TTP_CALENDAR_URL not configured' });

  try {
    const icsText = await fetchURL(calUrl);
    const events = parseICS(icsText);
    const now = new Date();

    // Build unique client locations from walks — NO geocoding, just return addresses
    const clientMap = {};
    events.forEach(e => {
      if (!e.client || e.client === 'Potential Client (general)') return;
      if (!clientMap[e.client]) {
        clientMap[e.client] = { locations: new Set(), services: new Set(), futureWalks: 0, pastWalks: 0 };
      }
      if (e.location) clientMap[e.client].locations.add(e.location);
      if (e.service) clientMap[e.client].services.add(e.service);
      if (new Date(e.start) > now) clientMap[e.client].futureWalks++;
      else clientMap[e.client].pastWalks++;
    });

    const clients = Object.entries(clientMap).map(([name, data]) => {
      const addr = [...data.locations][0] || '';
      const parts = addr.split(',').map(s => s.trim());
      const suburb = parts.length >= 2 ? parts[1].replace(/\s*(VIC|Victoria|AU-VIC)\s*/gi, '').trim() : '';

      return {
        refId: 'ttp_' + name.replace(/[^a-zA-Z0-9]/g, '_'),
        refType: 'client',
        name: name.replace(/\\+$/g, ''),
        status: data.futureWalks > 0 ? 'active' : 'inactive',
        suburb,
        addr,
        service: [...data.services][0] || '',
        futureWalks: data.futureWalks,
        pastWalks: data.pastWalks,
      };
    });

    res.json(clients);
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
