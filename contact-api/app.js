import express from "express";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 8;
const MAKE_TIMEOUT_MS = 10000;

const LIMITS = {
  name: 120,
  businessName: 120,
  businessType: 120,
  email: 254,
  phone: 20,
  service: 2000,
};

function asTrimmedString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isValidPhone(value) {
  const digits = value.replace(/\D/g, "");
  return digits.length === 10 || (digits.length === 11 && digits.startsWith("1"));
}

export function isAllowedOrigin(origin, allowedOrigins) {
  if (!origin) return false;
  if (allowedOrigins.includes(origin)) return true;

  try {
    const url = new URL(origin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return false;
    return url.hostname === "localhost" || url.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

export function parseContactBody(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { error: "Send a JSON object." };
  }

  if (asTrimmedString(body.website)) {
    return { ignored: true };
  }

  const payload = {
    name: asTrimmedString(body.name),
    businessName: asTrimmedString(body.businessName),
    businessType: asTrimmedString(body.businessType),
    email: asTrimmedString(body.email),
    phone: asTrimmedString(body.phone),
    service: asTrimmedString(body.service),
  };

  for (const [key, max] of Object.entries(LIMITS)) {
    if (payload[key].length > max) {
      return { error: `${key} is too long.` };
    }
  }

  if (!payload.name) return { error: "Name is required." };
  if (!payload.businessName) return { error: "Business name is required." };
  if (!payload.businessType) return { error: "Business type is required." };
  if (!payload.email) return { error: "Email is required." };
  if (!EMAIL_RE.test(payload.email)) return { error: "Enter a valid email address." };
  if (!payload.phone) return { error: "Phone is required." };
  if (!isValidPhone(payload.phone)) return { error: "Enter a valid phone number." };
  if (!payload.service) return { error: "Service description is required." };

  return { payload };
}

export async function sendWebhook({ webhookUrl, payload, timeoutMs = MAKE_TIMEOUT_MS }) {
  if (!webhookUrl) return { skipped: true };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "hireken-contact/1.0",
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      console.error(`Make webhook failed: ${response.status} ${body}`);
      return { ok: false, status: response.status };
    }

    return { ok: true };
  } catch (err) {
    console.error(`Make webhook error: ${err.message}`);
    return { ok: false, error: err.message };
  } finally {
    clearTimeout(timer);
  }
}

function clientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    return forwarded.split(",")[0].trim();
  }
  return req.ip || req.socket?.remoteAddress || "unknown";
}

export function createApp({
  webhookUrl = "",
  allowedOrigins = [],
  forwardWebhook = sendWebhook,
} = {}) {
  const app = express();
  const hits = new Map();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(express.json({ limit: "32kb" }));
  app.use(express.urlencoded({ extended: false, limit: "32kb" }));

  function applyCors(req, res) {
    const origin = req.headers.origin;
    if (origin && isAllowedOrigin(origin, allowedOrigins)) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
      res.setHeader("Access-Control-Max-Age", "86400");
      return true;
    }
    return false;
  }

  function rateLimited(ip) {
    const now = Date.now();
    const recent = (hits.get(ip) || []).filter((time) => now - time < RATE_WINDOW_MS);
    if (recent.length >= RATE_MAX) {
      hits.set(ip, recent);
      return true;
    }
    recent.push(now);
    hits.set(ip, recent);
    return false;
  }

  app.use((req, res, next) => {
    applyCors(req, res);
    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });

  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.get("/", (_req, res) => {
    res.json({ ok: true, service: "hireken-contact" });
  });

  app.post("/contact", async (req, res) => {
    const parsed = parseContactBody(req.body);
    if (parsed.ignored) {
      res.json({ ok: true });
      return;
    }

    if (parsed.error) {
      res.status(400).json({ ok: false, error: parsed.error });
      return;
    }

    if (rateLimited(clientIp(req))) {
      res.status(429).json({ ok: false, error: "Too many requests. Please try again later." });
      return;
    }

    if (!webhookUrl) {
      console.error("MAKE_WEBHOOK_URL is not set");
      res.status(503).json({ ok: false, error: "Contact delivery is not configured." });
      return;
    }

    const payload = {
      ...parsed.payload,
      submittedAt: new Date().toISOString(),
    };

    const result = await forwardWebhook({ webhookUrl, payload });
    if (!result.ok) {
      res.status(502).json({ ok: false, error: "The request could not be delivered." });
      return;
    }

    res.json({ ok: true });
  });

  return app;
}
