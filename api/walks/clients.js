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

const { rateLimit, requireAuth, safeError } = require('../_lib/security');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (rateLimit(req, res)) return;

  const calUrl = process.env.TTP_CALENDAR_URL;
  if (!calUrl) return res.status(500).json({ error: 'Calendar not configured' });

  try {
    const icsText = await fetchURL(calUrl);
    const events = parseICS(icsText);
    const now = new Date();

    // Build client map from all events
    const clientMap = {};
    events.forEach(e => {
      const name = e.client;
      if (!name || name === 'Potential Client (general)') return;
      if (!clientMap[name]) {
        clientMap[name] = {
          name,
          services: new Set(),
          locations: new Set(),
          suburbs: new Set(),
          walkers: new Set(),
          totalWalks: 0,
          futureWalks: 0,
          pastWalks: 0,
          lastWalk: null,
          nextWalk: null,
          firstWalk: null,
          lastBookedDate: null,
          dates: [],
        };
      }
      const c = clientMap[name];
      c.totalWalks++;
      if (e.service) c.services.add(e.service);
      if (e.location) {
        c.locations.add(e.location);
        // Extract suburb from location
        const parts = e.location.split(',').map(s => s.trim());
        if (parts.length >= 2) c.suburbs.add(parts[1].replace(/\s*(VIC|Victoria|AU-VIC)\s*/gi, '').trim());
      }
      if (e.walker) c.walkers.add(e.walker);

      const startDate = new Date(e.start);
      c.dates.push(startDate);

      if (startDate < now) {
        c.pastWalks++;
        if (!c.lastWalk || startDate > new Date(c.lastWalk)) c.lastWalk = e.date;
      } else {
        c.futureWalks++;
        if (!c.nextWalk || startDate < new Date(c.nextWalk)) c.nextWalk = e.date;
        if (!c.lastBookedDate || startDate > new Date(c.lastBookedDate)) c.lastBookedDate = e.date;
      }
      if (!c.firstWalk || startDate < new Date(c.firstWalk)) c.firstWalk = e.date;
    });

    // Calculate frequency and status
    const clients = Object.values(clientMap).map(c => {
      // Calculate walks per week (from last 4 weeks of data)
      const fourWeeksAgo = new Date(now); fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28);
      const recentWalks = c.dates.filter(d => d >= fourWeeksAgo && d <= now).length;
      const walksPerWeek = Math.round((recentWalks / 4) * 10) / 10;

      // Days booked ahead
      const daysAhead = c.lastBookedDate ? Math.ceil((new Date(c.lastBookedDate) - now) / 864e5) : 0;

      // Status
      let status = 'active';
      if (c.futureWalks === 0 && c.pastWalks > 0) status = 'no-upcoming';
      if (c.futureWalks === 0 && c.pastWalks === 0) status = 'inactive';

      return {
        name: c.name,
        services: [...c.services].join(', '),
        primaryService: [...c.services][0] || '',
        suburb: [...c.suburbs][0] || '',
        location: [...c.locations][0] || '',
        walker: [...c.walkers][0] || '',
        walksPerWeek,
        totalWalks: c.totalWalks,
        futureWalks: c.futureWalks,
        pastWalks: c.pastWalks,
        lastWalk: c.lastWalk,
        nextWalk: c.nextWalk,
        firstWalk: c.firstWalk,
        lastBookedDate: c.lastBookedDate,
        daysAhead,
        status,
      };
    });

    // Sort: active first, then by next walk date
    clients.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'active' ? -1 : 1;
      if (a.nextWalk && b.nextWalk) return a.nextWalk.localeCompare(b.nextWalk);
      return a.futureWalks > 0 ? -1 : 1;
    });

    res.json(clients);
  } catch (err) {
    safeError(res, 'Failed to fetch client data', err);
  }
};

// --- ICS Parser (shared with today.js) ---

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
      if (key === 'UID') event.uid = val;
    }
    if (event.summary && event.dtstart) {
      const start = parseICSDate(event.dtstart);
      const end = event.dtend ? parseICSDate(event.dtend) : null;
      const parts = (event.summary || '').replace(/\\+$/g, '').split(',').map(s => s.trim().replace(/\\+$/g, ''));
      events.push({
        client: parts[0] || '',
        walker: parts[1] || '',
        service: parts.slice(2).join(', ').trim() || '',
        location: event.location || '',
        start: start ? start.toISOString() : '',
        end: end ? end.toISOString() : '',
        date: start ? toMelbDate(start) : '',
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

function toMelbDate(d) {
  const str = d.toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
  const parts = str.match(/(\d+)\/(\d+)\/(\d+)/);
  if (!parts) return '';
  return `${parts[3]}-${parts[2].padStart(2, '0')}-${parts[1].padStart(2, '0')}`;
}
