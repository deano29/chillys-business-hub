const { notion, mapEnquiryFromNotion, mapEnquiryToNotion } = require('../../_lib/notion');
const { rateLimit, sanitizeEnquiryInput, validateNotionId, requireAuth, safeError } = require('../../_lib/security');

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (rateLimit(req, res)) return;
  if (await requireAuth(req, res)) return;

  const { id } = req.query;
  if (!validateNotionId(id)) return res.status(400).json({ error: 'Invalid ID format' });

  try {
    if (req.method === 'PATCH') {
      const data = sanitizeEnquiryInput(req.body);
      const page = await notion.pages.update({
        page_id: id,
        properties: mapEnquiryToNotion(data),
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
    safeError(res, 'Failed to update enquiry', err);
  }
};
