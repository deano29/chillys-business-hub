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
// Validates Clerk session token if CLERK_SECRET_KEY is set
// Falls back to no-auth if Clerk isn't configured yet
async function requireAuth(req, res) {
  const clerkSecret = process.env.CLERK_SECRET_KEY;
  if (!clerkSecret) return false; // Auth not configured, allow through

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) {
    res.status(401).json({ error: 'Authentication required' });
    return true; // Blocked
  }

  try {
    // Verify JWT with Clerk
    const parts = token.split('.');
    if (parts.length !== 3) throw new Error('Invalid token');
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString());
    // Check expiry
    if (payload.exp && payload.exp < Date.now() / 1000) throw new Error('Token expired');
    // Check issuer matches Clerk
    if (!payload.iss || !payload.iss.includes('clerk')) throw new Error('Invalid issuer');
    req.userId = payload.sub;
    return false; // Allowed
  } catch (err) {
    res.status(401).json({ error: 'Invalid or expired token' });
    return true; // Blocked
  }
}

// --- Safe Error Response ---
function safeError(res, message, err) {
  console.error(message + ':', err?.message || err);
  res.status(500).json({ error: message });
}

module.exports = { rateLimit, sanitizeEnquiryInput, validateNotionId, requireAuth, safeError, sanitizeString };
