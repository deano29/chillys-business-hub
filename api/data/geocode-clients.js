#!/usr/bin/env node
/**
 * Geocode client addresses from clients-enriched.json
 * Generates client-locations.json with lat/lng for the coverage map.
 * Run locally: node api/data/geocode-clients.js
 *
 * Uses Nominatim (free) with rate limiting. Takes ~2 mins for 48 clients.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const DATA_DIR = path.join(__dirname, '..', '_data');

function geocode(query) {
  return new Promise((resolve, reject) => {
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=au`;
    https.get(url, { headers: { 'User-Agent': 'ChillysBusinessHub/1.0' } }, (resp) => {
      let data = '';
      resp.on('data', chunk => data += chunk);
      resp.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results.length > 0) {
            resolve({ lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) });
          } else {
            resolve(null);
          }
        } catch { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

async function main() {
  console.log('\n🐾 Geocoding Client Addresses\n' + '='.repeat(50));

  const clientsPath = path.join(DATA_DIR, 'clients-enriched.json');
  if (!fs.existsSync(clientsPath)) {
    console.log('❌ clients-enriched.json not found. Run import.js first.');
    process.exit(1);
  }

  const clients = JSON.parse(fs.readFileSync(clientsPath, 'utf-8'));

  // Load existing locations to avoid re-geocoding
  const locationsPath = path.join(DATA_DIR, 'client-locations.json');
  let existing = {};
  if (fs.existsSync(locationsPath)) {
    const prev = JSON.parse(fs.readFileSync(locationsPath, 'utf-8'));
    prev.forEach(c => { existing[c.name] = c; });
  }

  const locations = [];
  let geocoded = 0, cached = 0, failed = 0;

  for (const client of clients) {
    const name = client.name;
    if (!name) continue;

    // Skip test/internal accounts
    if (name.toLowerCase().includes('dean haimes') || name.toLowerCase().includes('potential client')) continue;

    // Use cached location if available
    if (existing[name] && existing[name].lat) {
      locations.push(existing[name]);
      cached++;
      continue;
    }

    // Build address query
    const addr = client.address || '';
    const city = client.city || '';
    const state = client.state || 'VIC';
    let query = '';

    if (addr) {
      // Clean up address
      const cleanAddr = addr.replace(/\s+/g, ' ').trim();
      query = `${cleanAddr}, ${city || 'Melbourne'}, ${state}, Australia`;
    } else if (city) {
      query = `${city}, VIC, Australia`;
    }

    if (!query) {
      console.log(`  ⏭  ${name} — no address`);
      failed++;
      continue;
    }

    // Geocode
    await delay(1100); // Nominatim requires 1 request per second
    const result = await geocode(query);

    if (result) {
      // Determine suburb from address or city
      const suburb = city && isNaN(city) ? city : (addr.split(',').pop() || '').trim();

      locations.push({
        name,
        suburb: suburb || '',
        lat: result.lat,
        lng: result.lng,
        petNames: client.petNames || '',
        joinDate: client.joinDate || '',
        referralSource: client.referralSource || '',
      });
      console.log(`  ✅ ${name} — ${query.substring(0, 50)} → ${result.lat.toFixed(4)}, ${result.lng.toFixed(4)}`);
      geocoded++;
    } else {
      console.log(`  ❌ ${name} — failed to geocode: ${query.substring(0, 60)}`);
      // Still add with suburb-level approximation if possible
      failed++;
    }
  }

  // Save
  fs.writeFileSync(locationsPath, JSON.stringify(locations, null, 2));
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✅ Geocoded: ${geocoded}`);
  console.log(`📦 Cached: ${cached}`);
  console.log(`❌ Failed: ${failed}`);
  console.log(`📍 Total locations: ${locations.length}`);
  console.log(`\nSaved to: ${locationsPath}\n`);
}

main().catch(e => { console.error('Fatal error:', e); process.exit(1); });
