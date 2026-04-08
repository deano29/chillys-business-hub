// --- Rate Limiting ---
// Simple in-memory rate limiter (resets on cold start, which is fine for serverless)
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 60; // 60 requests per minute per IP

function getRateKey(req) {
  return req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || 'unknown';
}

function rateLimit(req, res) {
  const key = getRateKey(req);
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now - entry.start > RATE_LIMIT_WINDOW) {
    rateLimitMap.set(key, { start: now, count: 1 });
    return false; // Not limited
  }

  entry.count++;
  if (entry.count > RATE_LIMIT_MAX) {
    res.status(429).json({ error: 'Too many requests. Please try again later.' });
    return true; // Limited
  }
  return false;
}

// Clean up old entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.start > RATE_LIMIT_WINDOW * 2) rateLimitMap.delete(key);
  }
}, RATE_LIMIT_WINDOW * 2);

// --- Input Sanitization ---
function sanitizeString(str, maxLen = 500) {
  if (typeof str !== 'string') return '';
  return str.slice(0, maxLen).replace(/[<>]/g, ''); // Strip HTML tags
}

function sanitizeEnquiryInput(data) {
  if (!data || typeof data !== 'object') return {};
  const clean = {};
  const stringFields = ['name', 'phone', 'email', 'dogName', 'dogBreed', 'services', 'stage',
    'followup', 'source', 'suburb', 'notes', 'channel', 'urgency', 'preferredDays', 'enquiryType'];
  for (const field of stringFields) {
    if (data[field] !== undefined) clean[field] = sanitizeString(data[field]);
  }
  if (data.dateAdded) clean.dateAdded = sanitizeString(data.dateAdded, 20);
  return clean;
}

function validateNotionId(id) {
  // Notion IDs are UUIDs: 32 hex chars with optional dashes
  if (!id || typeof id !== 'string') return false;
  return /^[a-f0-9\-]{32,36}$/i.test(id);
}

// --- Auth Check ---
// Password auth is handled at the frontend gate (login overlay).
// API routes are protected by the frontend gate — no token needed.
async function requireAuth(req, res) {
  return false; // Auth handled by frontend password gate
}

// --- Safe Error Response ---
function safeError(res, message, err) {
  console.error(message + ':', err?.message || err);
  res.status(500).json({ error: message });
}

module.exports = { rateLimit, sanitizeEnquiryInput, validateNotionId, requireAuth, safeError, sanitizeString };
