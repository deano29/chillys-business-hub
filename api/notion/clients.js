const { notion, CLIENTS_DB, mapClientFromNotion } = require('../_lib/notion');
const { rateLimit, requireAuth, safeError } = require('../_lib/security');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (rateLimit(req, res)) return;
  if (await requireAuth(req, res)) return;

  try {
    if (req.method === 'GET') {
      const results = [];
      let cursor;
      do {
        const resp = await notion.databases.query({
          database_id: CLIENTS_DB,
          start_cursor: cursor,
          page_size: 100,
        });
        results.push(...resp.results.map(mapClientFromNotion));
        cursor = resp.has_more ? resp.next_cursor : undefined;
      } while (cursor);
      return res.json(results);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    safeError(res, 'Failed to fetch clients', err);
  }
};
