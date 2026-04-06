const fs = require('fs');
const path = require('path');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const parksPath = path.join(__dirname, '..', '_data', 'offleash-parks.json');
    const parks = JSON.parse(fs.readFileSync(parksPath, 'utf-8'));

    // Map to the format the frontend expects
    const result = parks.map((p, i) => ({
      id: 'park_' + i,
      name: p.name,
      lat: p.lat,
      lng: p.lng,
      suburb: p.suburb,
      type: p.fenced === 'yes' ? 'dog_park' : 'off_leash',
      fenced: p.fenced === 'yes',
      access: 'yes',
      surface: '',
      note: [p.notes, p.hours !== '24/7' ? 'Hours: ' + p.hours : ''].filter(Boolean).join('. '),
      council: p.council,
      hours: p.hours,
    }));

    res.json(result);
  } catch (err) {
    console.error('Off-leash parks error:', err.message);
    res.status(500).json({ error: 'Failed to load park data' });
  }
};
