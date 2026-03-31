const { notion, mapEnquiryFromNotion, mapEnquiryToNotion } = require('../../_lib/notion');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { id } = req.query;

  try {
    if (req.method === 'PATCH') {
      const page = await notion.pages.update({
        page_id: id,
        properties: mapEnquiryToNotion(req.body),
      });
      return res.json(mapEnquiryFromNotion(page));
    }

    if (req.method === 'DELETE') {
      await notion.pages.update({
        page_id: id,
        archived: true,
      });
      return res.json({ success: true });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Notion enquiry update error:', err.message);
    res.status(500).json({ error: err.message });
  }
};
