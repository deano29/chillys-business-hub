module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const calUrl = process.env.TTP_CALENDAR_URL;
  if (!calUrl) return res.status(500).json({ error: 'TTP_CALENDAR_URL not configured' });

  try {
    const response = await fetch(calUrl);
    const icsText = await response.text();
    const events = parseICS(icsText);

    // Filter and return based on query params
    const range = req.query.range || 'today'; // today, week, month
    const now = new Date();
    const filtered = filterByRange(events, now, range);

    // Sort by start time
    filtered.sort((a, b) => new Date(a.start) - new Date(b.start));

    res.json(filtered);
  } catch (err) {
    console.error('Walks fetch error:', err.message);
    res.status(500).json({ error: err.message });
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
      const parts = (event.summary || '').split(',').map(s => s.trim());
      const client = parts[0] || '';
      const walker = parts[1] || '';
      const service = parts.slice(2).join(', ').trim() || '';

      events.push({
        id: event.uid || '',
        client,
        walker,
        service,
        location: event.location || '',
        start: start ? start.toISOString() : '',
        end: end ? end.toISOString() : '',
        time: start ? formatTime(start) : '',
        endTime: end ? formatTime(end) : '',
        date: start ? start.toISOString().split('T')[0] : '',
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

function formatTime(d) {
  if (!d) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${m.toString().padStart(2, '0')}${ampm}`;
}

function getWalkStatus(start, end) {
  if (!start) return 'upcoming';
  const now = new Date();
  if (end && now > end) return 'completed';
  if (now >= start) return 'inprogress';
  return 'upcoming';
}

function filterByRange(events, now, range) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (range === 'today') {
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    return events.filter(e => {
      const d = new Date(e.start);
      return d >= today && d < tomorrow;
    });
  }
  if (range === 'week') {
    const weekStart = new Date(today);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
    return events.filter(e => {
      const d = new Date(e.start);
      return d >= weekStart && d < weekEnd;
    });
  }
  if (range === 'month') {
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    return events.filter(e => {
      const d = new Date(e.start);
      return d >= monthStart && d < monthEnd;
    });
  }
  return events;
}
