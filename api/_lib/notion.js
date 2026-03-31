const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const ENQUIRIES_DB = process.env.NOTION_ENQUIRIES_DB;
const CLIENTS_DB = process.env.NOTION_CLIENTS_DB;

// --- Property helpers ---

function text(prop) {
  if (!prop) return '';
  if (prop.type === 'title') return prop.title?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'rich_text') return prop.rich_text?.map(t => t.plain_text).join('') || '';
  if (prop.type === 'email') return prop.email || '';
  if (prop.type === 'phone_number') return prop.phone_number || '';
  if (prop.type === 'url') return prop.url || '';
  if (prop.type === 'number') return prop.number ?? '';
  if (prop.type === 'select') return prop.select?.name || '';
  if (prop.type === 'multi_select') return prop.multi_select?.map(s => s.name).join(', ') || '';
  if (prop.type === 'date') return prop.date?.start || '';
  if (prop.type === 'checkbox') return prop.checkbox || false;
  return '';
}

// --- Enquiry mapping ---

// Map from Notion property names to app field names
const ENQ_PROP_MAP = {
  'Lead Name': 'name',
  'Phone Number': 'phone',
  'Email': 'email',
  'Dog Name': 'dogName',
  'Dog Breed': 'dogBreed',
  'Services': 'services',
  'Qualification Stage': 'stage',
  'Enquiry Date': 'dateAdded',
  'Last Contacted': 'followup',
  'Source': 'source',
  'Suburb': 'suburb',
  'Notes': 'notes',
};

// Map app stage labels to IDs
const STAGE_TO_ID = {
  'New': 'new',
  'Contacted': 'contacted',
  'Info Sent': 'info-sent',
  'Meet & Greet': 'meet-greet',
  'Onboarding': 'onboarding',
  'Qualified': 'qualified',
  'Converted': 'converted',
  'Not Suitable': 'not-suitable',
  'Closed Lost': 'closed-lost',
  'Uncontactable': 'uncontactable',
};

const ID_TO_STAGE = Object.fromEntries(Object.entries(STAGE_TO_ID).map(([k, v]) => [v, k]));

function mapEnquiryFromNotion(page) {
  const p = page.properties;
  const raw = {};
  for (const [notionName, appField] of Object.entries(ENQ_PROP_MAP)) {
    if (p[notionName]) raw[appField] = text(p[notionName]);
  }
  return {
    id: page.id,
    name: raw.name || '',
    phone: raw.phone || '',
    email: raw.email || '',
    dogName: raw.dogName || '',
    dogBreed: raw.dogBreed || '',
    services: raw.services || '',
    stage: STAGE_TO_ID[raw.stage] || raw.stage?.toLowerCase().replace(/\s+/g, '-') || 'new',
    dateAdded: raw.dateAdded || '',
    followup: raw.followup || '',
    source: raw.source || '',
    suburb: raw.suburb || '',
    notes: raw.notes || '',
    channel: raw.source || '',
  };
}

function mapEnquiryToNotion(data) {
  const props = {};
  if (data.name !== undefined) props['Lead Name'] = { title: [{ text: { content: data.name } }] };
  if (data.phone !== undefined) props['Phone Number'] = { phone_number: data.phone || null };
  if (data.email !== undefined) props['Email'] = { email: data.email || null };
  if (data.dogName !== undefined) props['Dog Name'] = { rich_text: [{ text: { content: data.dogName } }] };
  if (data.dogBreed !== undefined) props['Dog Breed'] = { rich_text: [{ text: { content: data.dogBreed } }] };
  if (data.services !== undefined) props['Services'] = { rich_text: [{ text: { content: data.services } }] };
  if (data.stage !== undefined) props['Qualification Stage'] = { select: { name: ID_TO_STAGE[data.stage] || data.stage } };
  if (data.dateAdded !== undefined) props['Enquiry Date'] = { date: data.dateAdded ? { start: data.dateAdded } : null };
  if (data.followup !== undefined) props['Last Contacted'] = { date: data.followup ? { start: data.followup } : null };
  if (data.source !== undefined) props['Source'] = { select: { name: data.source } };
  if (data.suburb !== undefined) props['Suburb'] = { rich_text: [{ text: { content: data.suburb } }] };
  if (data.notes !== undefined) props['Notes'] = { rich_text: [{ text: { content: data.notes } }] };
  return props;
}

// --- Client mapping ---

function mapClientFromNotion(page) {
  const p = page.properties;
  return {
    id: page.id,
    owner: text(p['Owner Name'] || p['Name'] || {}),
    dog: text(p['Dog Name'] || {}),
    breed: text(p['Dog Breed'] || p['Breed'] || {}),
    phone: text(p['Phone'] || p['Phone Number'] || {}),
    email: text(p['Email'] || {}),
    walks: text(p['Walks Per Week'] || {}),
    nextWalk: text(p['Next Walk'] || {}),
    health: text(p['Health'] || p['Status'] || {}),
    tags: text(p['Tags'] || {}),
    suburb: text(p['Suburb'] || {}),
    monthWalks: text(p['Month Walks'] || {}),
    joined: text(p['Joined'] || {}),
    ltv: text(p['LTV'] || {}),
    address: text(p['Address'] || {}),
  };
}

module.exports = { notion, ENQUIRIES_DB, CLIENTS_DB, mapEnquiryFromNotion, mapEnquiryToNotion, mapClientFromNotion };
