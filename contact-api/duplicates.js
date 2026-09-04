const DEFAULT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizePhone(phone) {
  let digits = String(phone || "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    digits = digits.slice(1);
  }
  return digits;
}

export function contactKey(email, phone) {
  return `${normalizeEmail(email)}|${normalizePhone(phone)}`;
}

function stillFresh(map, key, now, windowMs) {
  const at = map.get(key);
  if (at == null) return false;
  if (now - at < windowMs) return true;
  map.delete(key);
  return false;
}

export function createDuplicateGuard({ windowMs = DEFAULT_WINDOW_MS } = {}) {
  const ips = new Map();
  const contacts = new Map();
  const inflightIps = new Set();
  const inflightContacts = new Set();

  function isDuplicate({ ip, email, phone, now = Date.now() }) {
    const key = contactKey(email, phone);
    if (ip && ip !== "unknown" && (stillFresh(ips, ip, now, windowMs) || inflightIps.has(ip))) {
      return true;
    }
    if (stillFresh(contacts, key, now, windowMs) || inflightContacts.has(key)) {
      return true;
    }
    return false;
  }

  function begin({ ip, email, phone }) {
    const key = contactKey(email, phone);
    if (ip && ip !== "unknown") inflightIps.add(ip);
    inflightContacts.add(key);
    return key;
  }

  function remember({ ip, email, phone, now = Date.now() }) {
    const key = contactKey(email, phone);
    if (ip && ip !== "unknown") ips.set(ip, now);
    contacts.set(key, now);
  }

  function end({ ip, email, phone }) {
    const key = contactKey(email, phone);
    if (ip && ip !== "unknown") inflightIps.delete(ip);
    inflightContacts.delete(key);
  }

  return { isDuplicate, begin, remember, end };
}
