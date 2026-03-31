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
// Actual Notion properties:
// Lead Name (title), Qualification Stage (multi_select), Source (select),
// Urgency (rich_text), Dog Count (number), Next Follow-up (rich_text),
// Enquiry date (date), Notes (rich_text), Preferred Days (rich_text),
// Last Contacted (date), Suburb (rich_text), Enquiry Type (select)

const ENQ_PROP_MAP = {
  'Lead Name': 'name',
  'Qualification Stage': 'stage',
  'Enquiry date': 'dateAdded',
  'Last Contacted': 'followup',
  'Source': 'source',
  'Suburb': 'suburb',
  'Notes': 'notes',
  'Urgency': 'urgency',
  'Dog Count': 'dogCount',
  'Next Follow-up': 'nextFollowup',
  'Preferred Days': 'preferredDays',
  'Enquiry Type': 'enquiryType',
};

// Map app stage labels to IDs
const STAGE_TO_ID = {
  'New': 'new',
  'Contacted': 'contacted',
  'Qualified': 'qualified',
  'Closed Won': 'closed-won',
  'Not Suitable': 'not-suitable',
  'Closed Lost': 'closed-lost',
  'Uncontactable': 'uncontactable',
  'Not Interested': 'not-interested',
  'Archived': 'archived',
};

const ID_TO_STAGE = Object.fromEntries(Object.entries(STAGE_TO_ID).map(([k, v]) => [v, k]));

function mapEnquiryFromNotion(page) {
  const p = page.properties;
  const raw = {};
  for (const [notionName, appField] of Object.entries(ENQ_PROP_MAP)) {
    if (p[notionName]) raw[appField] = text(p[notionName]);
  }
  // Qualification Stage is multi_select — first value = primary stage, rest = secondary qualifiers
  const stageParts = raw.stage ? raw.stage.split(', ') : [];
  const primaryStageRaw = stageParts[0] || '';
  const secondaryStages = stageParts.slice(1).map(s => STAGE_TO_ID[s] || s.toLowerCase().replace(/\s+/g, '-'));
  return {
    id: page.id,
    name: raw.name || '',
    phone: '',
    email: '',
    dogName: '',
    dogBreed: '',
    dogCount: raw.dogCount || '',
    services: '',
    stage: STAGE_TO_ID[primaryStageRaw] || primaryStageRaw?.toLowerCase().replace(/\s+/g, '-') || 'new',
    stageTags: secondaryStages,
    dateAdded: raw.dateAdded || '',
    followup: raw.followup || '',
    nextFollowup: raw.nextFollowup || '',
    source: raw.source || '',
    suburb: raw.suburb || '',
    notes: raw.notes || '',
    channel: raw.source || '',
    urgency: raw.urgency || '',
    preferredDays: raw.preferredDays || '',
    enquiryType: raw.enquiryType || '',
  };
}

function mapEnquiryToNotion(data) {
  const props = {};
  if (data.name !== undefined) props['Lead Name'] = { title: [{ text: { content: data.name } }] };
  if (data.stage !== undefined) props['Qualification Stage'] = { multi_select: [{ name: ID_TO_STAGE[data.stage] || data.stage }] };
  if (data.dateAdded !== undefined) props['Enquiry date'] = { date: data.dateAdded ? { start: data.dateAdded } : null };
  if (data.followup !== undefined) props['Last Contacted'] = { date: data.followup ? { start: data.followup } : null };
  if (data.source !== undefined) props['Source'] = { select: { name: data.source } };
  if (data.suburb !== undefined) props['Suburb'] = { rich_text: [{ text: { content: data.suburb } }] };
  if (data.notes !== undefined) props['Notes'] = { rich_text: [{ text: { content: data.notes } }] };
  if (data.urgency !== undefined) props['Urgency'] = { rich_text: [{ text: { content: data.urgency } }] };
  if (data.preferredDays !== undefined) props['Preferred Days'] = { rich_text: [{ text: { content: data.preferredDays } }] };
  if (data.enquiryType !== undefined) props['Enquiry Type'] = { select: { name: data.enquiryType } };
  return props;
}

// --- Client mapping ---
// Actual Notion properties:
// Client Name (title), Status (select), Suburb (rich_text), Days Per Week (number),
// Primary Service (select), Plan / Package (select), Client Type (select),
// Preferred Days (multi_select), Notes (rich_text), Dogs (number)

function mapClientFromNotion(page) {
  const p = page.properties;
  return {
    id: page.id,
    owner: text(p['Client Name'] || {}),
    dog: '',
    breed: '',
    phone: '',
    email: '',
    walks: text(p['Days Per Week'] || {}),
    nextWalk: '',
    health: (text(p['Status'] || {}) || 'active').toLowerCase(),
    tags: [],
    suburb: text(p['Suburb'] || {}),
    monthWalks: '',
    joined: '',
    ltv: '',
    address: '',
    primaryService: text(p['Primary Service'] || {}),
    planPackage: text(p['Plan / Package'] || {}),
    clientType: text(p['Client Type'] || {}),
    preferredDays: text(p['Preferred Days'] || {}),
    notes: text(p['Notes'] || {}),
    dogs: text(p['Dogs'] || {}),
  };
}

module.exports = { notion, ENQUIRIES_DB, CLIENTS_DB, mapEnquiryFromNotion, mapEnquiryToNotion, mapClientFromNotion };
