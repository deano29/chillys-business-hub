#!/usr/bin/env node
/**
 * TTP Data Import Script
 * Parses CSV exports from Time to Pet and generates JSON files for the API.
 * Run locally: node api/data/import.js
 */

const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const OUT_DIR = path.join(__dirname, '..', '_data');

// Ensure output directory exists
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

// ── CSV Parser (handles quoted fields with commas and newlines) ──
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i + 1];
    if (inQuote) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuote = false; }
      else { field += c; }
    } else {
      if (c === '"') { inQuote = true; }
      else if (c === ',') { row.push(field.trim()); field = ''; }
      else if (c === '\n' || (c === '\r' && next === '\n')) {
        row.push(field.trim()); field = '';
        if (row.some(f => f !== '')) rows.push(row);
        row = [];
        if (c === '\r') i++;
      } else { field += c; }
    }
  }
  if (field || row.length) { row.push(field.trim()); if (row.some(f => f !== '')) rows.push(row); }
  return rows;
}

function csvToObjects(text) {
  const rows = parseCSV(text);
  if (rows.length < 2) return [];
  const headers = rows[0];
  return rows.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] || ''; });
    return obj;
  });
}

// ── Parse dollar amounts ──
function parseDollar(str) {
  if (!str) return 0;
  return parseFloat(str.replace(/[$,]/g, '')) || 0;
}

// ── Parse TTP date format: "Nov 12, 2025 3:30 PM" → ISO ──
function parseTTPDate(str) {
  if (!str) return null;
  const d = new Date(str);
  if (isNaN(d.getTime())) return null;
  return d;
}

function toISODate(d) {
  if (!d) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function toISODateTime(d) {
  if (!d) return '';
  return d.toISOString();
}

function formatTime(d) {
  if (!d) return '';
  let h = d.getHours();
  const m = d.getMinutes();
  const ampm = h >= 12 ? 'pm' : 'am';
  h = h % 12 || 12;
  return `${h}:${String(m).padStart(2, '0')}${ampm}`;
}

// ── Parse month format: "Nov 2025" → "2025-11" ──
function parseMonthStr(str) {
  if (!str) return null;
  const d = new Date(str + ' 1');
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ═══════════════════════════════════════
// 1. WALKS HISTORY
// ═══════════════════════════════════════
function importWalks() {
  const file = path.join(DATA_DIR, 'walks.csv');
  if (!fs.existsSync(file)) { console.log('⏭  walks.csv not found, skipping'); return; }

  const text = fs.readFileSync(file, 'utf-8');
  const rows = csvToObjects(text);
  console.log(`📂 walks.csv: ${rows.length} rows`);

  const walks = [];
  for (const r of rows) {
    const start = parseTTPDate(r['Start']);
    const end = parseTTPDate(r['End']);
    if (!start) continue;

    const status = (r['Status'] || '').toLowerCase();
    const checkRev = parseDollar(r['Service Revenue']) + parseDollar(r['Pet Fees']) + parseDollar(r['Holiday Fees']) + parseDollar(r['After Hours Fees']) + parseDollar(r['Weekend Fees']);
    if (status === 'cancelled' && checkRev <= 0) continue; // Skip cancelled walks with no revenue (keep cancellation fees)

    const serviceRevenue = parseDollar(r['Service Revenue']);
    const petFees = parseDollar(r['Pet Fees']);
    const holidayFees = parseDollar(r['Holiday Fees']);
    const afterHoursFees = parseDollar(r['After Hours Fees']);
    const weekendFees = parseDollar(r['Weekend Fees']);
    const staffPaid = parseDollar(r['Staff Paid']);
    const totalRevenue = serviceRevenue + petFees + holidayFees + afterHoursFees + weekendFees;

    walks.push({
      client: (r['Client'] || '').trim(),
      walker: normaliseWalkerName(r['User'] || ''),
      service: (r['Service'] || '').trim(),
      date: toISODate(start),
      start: toISODateTime(start),
      end: end ? toISODateTime(end) : '',
      time: formatTime(start),
      endTime: end ? formatTime(end) : '',
      status: status === 'completed' ? 'completed' : status === 'scheduled' ? 'upcoming' : status === 'cancelled' ? 'cancelled' : status,
      revenue: serviceRevenue,
      petFees,
      holidayFees,
      afterHoursFees,
      weekendFees,
      staffPaid,
      totalRevenue,
      source: 'ttp-csv',
    });
  }

  // Sort by date
  walks.sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));

  const outFile = path.join(OUT_DIR, 'walks-history.json');
  fs.writeFileSync(outFile, JSON.stringify(walks, null, 2));
  console.log(`✅ walks-history.json: ${walks.length} walks (${walks.filter(w => w.status === 'completed').length} completed, ${walks.filter(w => w.status === 'upcoming').length} scheduled)`);

  // Date range
  const dates = walks.map(w => w.date).filter(Boolean);
  console.log(`   Range: ${dates[0]} → ${dates[dates.length - 1]}`);
}

function normaliseWalkerName(name) {
  // TTP uses full names like "Jessica Rose Lauritz" or "Jessica Lauritz"
  return (name || '').trim()
    .replace('Jessica Rose Lauritz', 'Jessica Lauritz')
    .replace('Alex Cass', 'Alex Cass');
}

// ═══════════════════════════════════════
// 2. REVENUE OVER TIME
// ═══════════════════════════════════════
function importRevenueMonthly() {
  const file = path.join(DATA_DIR, 'revenue-over-time.csv');
  if (!fs.existsSync(file)) { console.log('⏭  revenue-over-time.csv not found, skipping'); return; }

  const text = fs.readFileSync(file, 'utf-8');
  const rows = parseCSV(text);

  const data = [];
  for (const row of rows) {
    if (row.length < 2) continue;
    const monthStr = row[0];
    const revenue = parseFloat((row[1] || '0').replace(/[,$]/g, '')) || 0;
    const month = parseMonthStr(monthStr);
    if (!month) continue;
    data.push({ month, label: monthStr, revenue });
  }

  const outFile = path.join(OUT_DIR, 'revenue-monthly.json');
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(`✅ revenue-monthly.json: ${data.length} months`);
}

// ═══════════════════════════════════════
// 3. CLIENT REVENUE TOTALS
// ═══════════════════════════════════════
function importClientRevenue() {
  const file = path.join(DATA_DIR, 'client-revenue-total.csv');
  if (!fs.existsSync(file)) { console.log('⏭  client-revenue-total.csv not found, skipping'); return; }

  const text = fs.readFileSync(file, 'utf-8');
  const rows = csvToObjects(text);

  const data = {};
  for (const r of rows) {
    const name = (r['Client'] || '').trim();
    const amount = parseDollar(r['Amount']);
    if (name && name !== 'Potential Client (general)') {
      data[name] = amount;
    }
  }

  const outFile = path.join(OUT_DIR, 'revenue-by-client.json');
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(`✅ revenue-by-client.json: ${Object.keys(data).length} clients`);
}

// ═══════════════════════════════════════
// 4. REVENUE BY SERVICE
// ═══════════════════════════════════════
function importServiceRevenue() {
  const file = path.join(DATA_DIR, 'by-service.csv');
  if (!fs.existsSync(file)) { console.log('⏭  by-service.csv not found, skipping'); return; }

  const text = fs.readFileSync(file, 'utf-8');
  const rows = csvToObjects(text);

  const data = [];
  for (const r of rows) {
    const service = (r['Service'] || '').trim();
    const amount = parseDollar(r['Amount']);
    const count = parseInt(r['Count']) || 0;
    if (service) data.push({ service, revenue: amount, count });
  }
  data.sort((a, b) => b.revenue - a.revenue);

  const outFile = path.join(OUT_DIR, 'revenue-by-service.json');
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(`✅ revenue-by-service.json: ${data.length} services`);
}

// ═══════════════════════════════════════
// 5. REFERRALS
// ═══════════════════════════════════════
function importReferrals() {
  const file = path.join(DATA_DIR, 'referrals.csv');
  if (!fs.existsSync(file)) { console.log('⏭  referrals.csv not found, skipping'); return; }

  const text = fs.readFileSync(file, 'utf-8');
  const rows = parseCSV(text);

  const data = {};
  for (const row of rows) {
    if (row.length < 2) continue;
    const source = (row[0] || '').trim();
    const revenue = parseFloat((row[1] || '0').replace(/[,$]/g, '')) || 0;
    if (source && source !== '' && source !== 'By Referral') {
      data[source] = revenue;
    }
  }

  const outFile = path.join(OUT_DIR, 'referrals.json');
  fs.writeFileSync(outFile, JSON.stringify(data, null, 2));
  console.log(`✅ referrals.json: ${Object.keys(data).length} sources`);
}

// ═══════════════════════════════════════
// 6. CLIENT PROFILES
// ═══════════════════════════════════════
function importClients() {
  const file = path.join(DATA_DIR, 'clients activated portal.csv');
  if (!fs.existsSync(file)) { console.log('⏭  clients activated portal.csv not found, skipping'); return; }

  const text = fs.readFileSync(file, 'utf-8');
  const rows = parseCSV(text);
  if (rows.length < 3) { console.log('⏭  clients CSV too short'); return; }

  // Row 0 = headers, Row 1 = sub-headers ("Primary Contact", "Address", etc.), Row 2+ = data
  const headers = rows[0];
  const clients = [];

  for (let i = 2; i < rows.length; i++) {
    const row = rows[i];
    const get = (col) => {
      const idx = headers.indexOf(col);
      // Handle duplicate column names (Email appears twice — primary contact vs emergency)
      return idx >= 0 ? (row[idx] || '').trim() : '';
    };
    const getIdx = (idx) => (row[idx] || '').trim();

    const name = getIdx(0); // Full Name
    if (!name) continue;

    clients.push({
      name,
      email: getIdx(1),
      phone: getIdx(3),
      referralSource: getIdx(5),
      address: [getIdx(7), getIdx(8)].filter(Boolean).join(', '),
      city: getIdx(9),
      state: getIdx(10),
      postcode: getIdx(11),
      emergencyName: getIdx(12),
      emergencyRelation: getIdx(13),
      emergencyEmail: getIdx(14),
      emergencyPhone: getIdx(15),
      notes: getIdx(19),
      joinDate: getIdx(23),
      petNames: getIdx(27),
    });
  }

  const outFile = path.join(OUT_DIR, 'clients-enriched.json');
  fs.writeFileSync(outFile, JSON.stringify(clients, null, 2));
  console.log(`✅ clients-enriched.json: ${clients.length} clients`);
}

// ═══════════════════════════════════════
// 7. PRICING BY CLIENT (auto-calculated from walk history)
// ═══════════════════════════════════════
function importPricing() {
  const walksFile = path.join(OUT_DIR, 'walks-history.json');
  if (!fs.existsSync(walksFile)) { console.log('⏭  walks-history.json not found, skipping pricing'); return; }

  const walks = JSON.parse(fs.readFileSync(walksFile, 'utf-8'));

  // Group by client → service type → collect revenues
  const clientMap = {};
  for (const w of walks) {
    if (!w.client || w.totalRevenue <= 0) continue;
    if (!clientMap[w.client]) clientMap[w.client] = {};
    const svc = w.service || 'Unknown';
    if (!clientMap[w.client][svc]) clientMap[w.client][svc] = { total: 0, count: 0, prices: [] };
    clientMap[w.client][svc].total += w.totalRevenue;
    clientMap[w.client][svc].count++;
    clientMap[w.client][svc].prices.push(w.totalRevenue);
  }

  // Build output: per-client, per-service averages
  const pricing = {};
  for (const [client, services] of Object.entries(clientMap)) {
    pricing[client] = {};
    let clientTotal = 0;
    let clientWalks = 0;
    for (const [svc, data] of Object.entries(services)) {
      const avg = Math.round((data.total / data.count) * 100) / 100;
      // Most recent price (last 5 walks of this type)
      const recent = data.prices.slice(-5);
      const recentAvg = Math.round((recent.reduce((s, p) => s + p, 0) / recent.length) * 100) / 100;
      pricing[client][svc] = {
        avgPrice: avg,
        recentPrice: recentAvg,
        walkCount: data.count,
        totalRevenue: Math.round(data.total * 100) / 100,
      };
      clientTotal += data.total;
      clientWalks += data.count;
    }
    pricing[client]._summary = {
      totalRevenue: Math.round(clientTotal * 100) / 100,
      totalWalks: clientWalks,
      avgPerWalk: clientWalks > 0 ? Math.round((clientTotal / clientWalks) * 100) / 100 : 0,
    };
  }

  const outFile = path.join(OUT_DIR, 'pricing-by-client.json');
  fs.writeFileSync(outFile, JSON.stringify(pricing, null, 2));
  console.log(`✅ pricing-by-client.json: ${Object.keys(pricing).length} clients with pricing`);
}

// ═══════════════════════════════════════
// RUN ALL IMPORTS
// ═══════════════════════════════════════
console.log('\n🐾 TTP Data Import\n' + '='.repeat(40));
console.log(`Source: ${DATA_DIR}`);
console.log(`Output: ${OUT_DIR}\n`);

importWalks();
importRevenueMonthly();
importClientRevenue();
importServiceRevenue();
importReferrals();
importClients();
importPricing();

console.log('\n✅ All imports complete!\n');
