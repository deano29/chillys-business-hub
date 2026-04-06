const https = require('https');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');

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
      // Follow redirects
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
  // Auth skipped — walks data is from a public ICS feed, not sensitive

  const calUrl = process.env.TTP_CALENDAR_URL;
  if (!calUrl) return res.status(500).json({ error: 'Calendar not configured' });

  try {
    const icsText = await fetchURL(calUrl);
    const events = parseICS(icsText);

    // Validate range param
    const validRanges = ['today', 'week', 'month', 'all', 'debug'];
    const range = validRanges.includes(req.query.range) ? req.query.range : 'today';
    const now = new Date();

    // Debug mode: return feed stats (includes merged history)
    if (range === 'debug') {
      const merged = mergeWithHistory(events);
      const dates = merged.map(e => e.date).filter(Boolean).sort();
      const walkers = [...new Set(merged.map(e => e.walker).filter(Boolean))];
      const clients = [...new Set(merged.map(e => e.client).filter(Boolean))];
      const byMonth = {};
      dates.forEach(d => { const m = d.substring(0, 7); byMonth[m] = (byMonth[m] || 0) + 1; });
      return res.json({
        totalEvents: merged.length,
        icsEvents: events.length,
        historyEvents: merged.length - events.length,
        earliestDate: dates[0] || null,
        latestDate: dates[dates.length - 1] || null,
        dateRange: dates.length ? `${dates[0]} to ${dates[dates.length - 1]}` : 'No events',
        walkers,
        uniqueClients: clients.length,
        eventsByMonth: byMonth,
        icsBytes: icsText.length,
      });
    }

    // Merge with historical data for all ranges
    const source = mergeWithHistory(events);
    const filtered = filterByRange(source, now, range);

    // Sort by start time
    filtered.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.json(filtered);
  } catch (err) {
    safeError(res, 'Failed to fetch walks', err);
  }
};

function parseICS(text) {
  const events = [];
  const blocks = text.split('BEGIN:VEVENT');
  for (let i = 1; i < blocks.length; i++) {
    const block = blocks[i].split('END:VEVENT')[0];
    const event = {};
    // Handle folded lines (lines starting with space/tab are continuations)
    const unfolded = block.replace(/\r?\n[ \t]/g, '');
    const lines = unfolded.split(/\r?\n/);
    for (const line of lines) {
      const match = line.match(/^([A-Z\-;]+?)[:;](.+)/);
      if (!match) continue;
      const key = match[1].split(';')[0];
      let val = match[2];
      // Handle parameters like DTSTART;TZID=...
      if (line.includes('TZID=')) {
        val = val.split(':').pop();
      }
      if (key === 'SUMMARY') event.summary = val;
      if (key === 'LOCATION') event.location = (val || '').replace(/\\n/g, ', ').replace(/\\,/g, ',');
      if (key === 'DESCRIPTION') event.description = (val || '').replace(/\\n/g, '\n').replace(/\\,/g, ',');
      if (key === 'DTSTART') event.dtstart = val;
      if (key === 'DTEND') event.dtend = val;
      if (key === 'UID') event.uid = val;
    }
    if (event.summary && event.dtstart) {
      const start = parseICSDate(event.dtstart);
      const end = event.dtend ? parseICSDate(event.dtend) : null;
      // Parse summary: "Client Name, Walker Name, Service Type"
      const parts = (event.summary || '').replace(/\\+$/g, '').split(',').map(s => s.trim().replace(/\\+$/g, ''));
      const client = parts[0] || '';
      const walker = parts[1] || '';
      const service = parts.slice(2).join(', ').trim() || '';

      // Convert UTC to AEST/AEDT for display
      const startLocal = start ? toAEST(start) : null;
      const endLocal = end ? toAEST(end) : null;

      events.push({
        id: event.uid || '',
        client,
        walker,
        service,
        location: event.location || '',
        start: start ? start.toISOString() : '',
        end: end ? end.toISOString() : '',
        time: startLocal ? formatTime(startLocal) : '',
        endTime: endLocal ? formatTime(endLocal) : '',
        date: startLocal ? formatLocalDate(startLocal) : '',
        status: getWalkStatus(start, end),
      });
    }
  }
  return events;
}

function parseICSDate(str) {
  if (!str) return null;
  // Format: 20260306T150000 or 20260306T150000Z
  const clean = str.replace(/[^0-9TZ]/g, '');
  if (clean.length >= 15) {
    const y = clean.substr(0, 4);
    const m = clean.substr(4, 2);
    const d = clean.substr(6, 2);
    const h = clean.substr(9, 2);
    const min = clean.substr(11, 2);
    const s = clean.substr(13, 2);
    if (clean.endsWith('Z')) {
      return new Date(Date.UTC(+y, +m - 1, +d, +h, +min, +s));
    }
    return new Date(+y, +m - 1, +d, +h, +min, +s);
  }
  return new Date(str);
}

// Convert UTC Date to AEST/AEDT (Melbourne)
function toAEST(d) {
  // Use Intl to get the correct offset including DST
  const str = d.toLocaleString('en-AU', { timeZone: 'Australia/Melbourne' });
  // Parse "DD/MM/YYYY, HH:MM:SS AM/PM" format
  const parts = str.match(/(\d+)\/(\d+)\/(\d+),?\s+(\d+):(\d+):(\d+)\s*(AM|PM)?/i);
  if (!parts) return d;
  let [, day, month, year, hours, mins, secs, ampm] = parts;
  if (ampm) {
    hours = +hours;
    if (ampm.toUpperCase() === 'PM' && hours !== 12) hours += 12;
    if (ampm.toUpperCase() === 'AM' && hours === 12) hours = 0;
  }
  return { year: +year, month: +month, day: +day, hours: +hours, minutes: +mins };
}

function formatLocalDate(local) {
  return `${local.year}-${String(local.month).padStart(2, '0')}-${String(local.day).padStart(2, '0')}`;
}

function formatTime(local) {
  if (!local) return '';
  let h = local.hours;
  const m = local.minutes;
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')}${ampm}`;
}

function getWalkStatus(start, end) {
  if (!start) return 'upcoming';
  const now = new Date();
  if (end && now > end) return 'completed';
  if (now >= start) return 'inprogress';
  return 'upcoming';
}

function filterByRange(events, now, range) {
  // Use Melbourne time for filtering
  const melb = toAEST(now);
  const todayStr = formatLocalDate(melb);

  if (range === 'today') {
    return events.filter(e => e.date === todayStr);
  }
  if (range === 'week') {
    // Get Monday of current week
    const d = new Date(melb.year, melb.month - 1, melb.day);
    const dow = d.getDay() || 7; // Sunday=7
    const monday = new Date(d); monday.setDate(d.getDate() - dow + 1);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const weekStart = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
    const weekEnd = `${sunday.getFullYear()}-${String(sunday.getMonth() + 1).padStart(2, '0')}-${String(sunday.getDate()).padStart(2, '0')}`;
    return events.filter(e => e.date >= weekStart && e.date <= weekEnd);
  }
  if (range === 'month') {
    const monthPrefix = `${melb.year}-${String(melb.month).padStart(2, '0')}`;
    return events.filter(e => e.date.startsWith(monthPrefix));
  }
  if (range === 'upcoming') {
    // Today + next 30 days
    const d = new Date(melb.year, melb.month - 1, melb.day);
    const end = new Date(d); end.setDate(d.getDate() + 30);
    const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    return events.filter(e => e.date >= todayStr && e.date <= endStr);
  }
  if (range === 'all') {
    return events;
  }
  return events;
}

// ── MERGE WITH HISTORICAL CSV DATA ──
function mergeWithHistory(icsEvents) {
  const historyPath = path.join(__dirname, '..', '_data', 'walks-history.json');
  let history = [];
  try {
    if (fs.existsSync(historyPath)) {
      history = JSON.parse(fs.readFileSync(historyPath, 'utf-8'));
    }
  } catch (e) {
    console.warn('Could not load walks history:', e.message);
    return icsEvents;
  }

  if (!history.length) return icsEvents;

  // Build a set of ICS event keys for deduplication
  // Key = client + date + start time (normalized)
  const icsKeys = new Set();
  icsEvents.forEach(e => {
    const key = `${(e.client || '').trim().toLowerCase()}|${e.date}|${e.time}`;
    icsKeys.add(key);
  });

  // Add historical walks that aren't in the ICS feed
  const merged = [...icsEvents];
  let added = 0;
  for (const h of history) {
    const key = `${(h.client || '').trim().toLowerCase()}|${h.date}|${h.time}`;
    if (!icsKeys.has(key)) {
      merged.push(h);
      added++;
    }
  }

  return merged;
}
