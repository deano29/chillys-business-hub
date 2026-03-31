const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

module.exports = async function handler(req, res) {
  try {
    const dbId = req.query.db === 'clients' ? process.env.NOTION_CLIENTS_DB : process.env.NOTION_ENQUIRIES_DB;
    if (req.query.raw) {
      const resp = await notion.databases.query({ database_id: dbId, page_size: 2 });
      return res.json(resp.results.map(p => ({ id: p.id, properties: p.properties })));
    }
    const resp = await notion.databases.retrieve({ database_id: dbId });
    const props = Object.entries(resp.properties).map(([name, p]) => ({ name, type: p.type }));
    res.json({ title: resp.title?.[0]?.plain_text, properties: props });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
