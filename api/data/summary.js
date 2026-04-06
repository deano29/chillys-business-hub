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
  const clientTypes = loadJSON('client-types.json');

  // Handle POST to save client type
  if (req.method === 'POST') {
    try {
      const { clientName, clientType } = req.body || {};
      if (!clientName || !['regular', 'project', 'adhoc', ''].includes(clientType)) {
        return res.status(400).json({ error: 'Invalid client name or type' });
      }
      const types = clientTypes || {};
      if (clientType) types[clientName] = clientType;
      else delete types[clientName];
      const typesPath = path.join(DATA_DIR, 'client-types.json');
      fs.writeFileSync(typesPath, JSON.stringify(types, null, 2));
      return res.json({ ok: true, clientTypes: types });
    } catch (e) {
      return res.status(500).json({ error: 'Failed to save' });
    }
  }

  res.json({
    revenueMonthly: revenueMonthly || [],
    revenueByClient: revenueByClient || {},
    revenueByService: revenueByService || [],
    referrals: referrals || {},
    pricingByClient: pricingByClient || {},
    clientLocations: clientLocations || [],
    clientTypes: clientTypes || {},
    hasData: !!(revenueMonthly && revenueMonthly.length),
  });
};
