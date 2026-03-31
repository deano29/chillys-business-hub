const { notion, ENQUIRIES_DB, mapEnquiryFromNotion, mapEnquiryToNotion } = require('../_lib/notion');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    if (req.method === 'GET') {
      const results = [];
      let cursor;
      do {
        const resp = await notion.databases.query({
          database_id: ENQUIRIES_DB,
          start_cursor: cursor,
          page_size: 100,
        });
        results.push(...resp.results.map(mapEnquiryFromNotion));
        cursor = resp.has_more ? resp.next_cursor : undefined;
      } while (cursor);
      return res.json(results);
    }

    if (req.method === 'POST') {
      const data = req.body;
      const page = await notion.pages.create({
        parent: { database_id: ENQUIRIES_DB },
        properties: mapEnquiryToNotion(data),
      });
      return res.json(mapEnquiryFromNotion(page));
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Notion enquiries error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
