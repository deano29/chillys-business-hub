const { Client } = require('@notionhq/client');
const { rateLimit, requireAuth, safeError } = require('../_lib/security');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const CONFIG_DB = process.env.NOTION_CONFIG_DB;

// Stores app settings as a single Notion DB row with a "JSON" rich_text property.
// Row title is "Settings" (constant). Avoids per-key API churn — read/write the whole blob.

const ROW_TITLE = 'Settings';

async function findRow() {
  const resp = await notion.databases.query({
    database_id: CONFIG_DB,
    filter: { property: 'Name', title: { equals: ROW_TITLE } },
    page_size: 1,
  });
  return resp.results[0] || null;
}

function readJson(page) {
  const prop = page?.properties?.JSON;
  const text = prop?.rich_text?.map(t => t.plain_text).join('') || '';
  if (!text) return {};
  try { return JSON.parse(text); } catch { return {}; }
}

async function writeJson(obj) {
  const json = JSON.stringify(obj);
  // Notion rich_text has a 2000 char per chunk limit but accepts multiple chunks.
  // For typical settings (<5KB) this is fine; chunk if needed.
  const chunks = [];
  for (let i = 0; i < json.length; i += 1900) chunks.push(json.slice(i, i + 1900));
  const richText = chunks.map(c => ({ text: { content: c } }));

  const existing = await findRow();
  if (existing) {
    await notion.pages.update({
      page_id: existing.id,
      properties: { JSON: { rich_text: richText } },
    });
  } else {
    await notion.pages.create({
      parent: { database_id: CONFIG_DB },
      properties: {
        Name: { title: [{ text: { content: ROW_TITLE } }] },
        JSON: { rich_text: richText },
      },
    });
  }
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (rateLimit(req, res)) return;
  if (await requireAuth(req, res)) return;
  if (!CONFIG_DB) return res.status(500).json({ error: 'NOTION_CONFIG_DB env var not set' });

  try {
    if (req.method === 'GET') {
      const row = await findRow();
      return res.json(row ? readJson(row) : {});
    }
    if (req.method === 'PUT' || req.method === 'POST') {
      const body = req.body || {};
      if (typeof body !== 'object') return res.status(400).json({ error: 'Body must be an object' });
      await writeJson(body);
      return res.json({ ok: true });
    }
    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    safeError(res, 'Failed to process config', err);
  }
};
