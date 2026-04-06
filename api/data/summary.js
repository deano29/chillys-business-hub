const fs = require('fs');
const path = require('path');
const { rateLimit } = require('../_lib/security');

const DATA_DIR = path.join(__dirname, '..', '_data');

function loadJSON(filename) {
  const file = path.join(DATA_DIR, filename);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf-8'));
  } catch (e) { /* silent */ }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (rateLimit(req, res)) return;

  const revenueMonthly = loadJSON('revenue-monthly.json');
  const revenueByClient = loadJSON('revenue-by-client.json');
  const revenueByService = loadJSON('revenue-by-service.json');
  const referrals = loadJSON('referrals.json');
  const pricingByClient = loadJSON('pricing-by-client.json');
  const clientLocations = loadJSON('client-locations.json');

  res.json({
    revenueMonthly: revenueMonthly || [],
    revenueByClient: revenueByClient || {},
    revenueByService: revenueByService || [],
    referrals: referrals || {},
    pricingByClient: pricingByClient || {},
    clientLocations: clientLocations || [],
    hasData: !!(revenueMonthly && revenueMonthly.length),
  });
};
