import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, before, describe, it } from "node:test";
import { createApp, isAllowedOrigin, parseContactBody } from "../app.js";
import { contactKey, normalizePhone } from "../duplicates.js";

const validBody = {
  name: "Ada Lovelace",
  businessName: "Analytical Engines",
  businessType: "Consulting",
  email: "ada@example.com",
  phone: "412-555-0100",
  service: "Need a contact form that posts to Render.",
};

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}` });
    });
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

describe("parseContactBody", () => {
  it("accepts a complete request", () => {
    const result = parseContactBody(validBody);
    assert.equal(result.error, undefined);
    assert.equal(result.payload.email, "ada@example.com");
  });

  it("rejects an invalid email", () => {
    const result = parseContactBody({ ...validBody, email: "not-an-email" });
    assert.equal(result.error, "Enter a valid email address.");
  });

  it("ignores honeypot submissions", () => {
    const result = parseContactBody({ ...validBody, website: "https://spam.test" });
    assert.equal(result.ignored, true);
  });
});

describe("isAllowedOrigin", () => {
  const allowed = ["https://empoweringdavid.com"];

  it("allows configured origins", () => {
    assert.equal(isAllowedOrigin("https://empoweringdavid.com", allowed), true);
  });

  it("allows localhost", () => {
    assert.equal(isAllowedOrigin("http://localhost:8080", allowed), true);
  });

  it("rejects other origins", () => {
    assert.equal(isAllowedOrigin("https://evil.example", allowed), false);
  });
});

describe("POST /contact", () => {
  const received = [];
  let makeServer;
  let makeUrl;
  let appServer;
  let appUrl;

  before(async () => {
    makeServer = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        received.push({
          method: req.method,
          contentType: req.headers["content-type"],
          body: JSON.parse(body),
        });
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Accepted");
      });
    });

    makeUrl = await new Promise((resolve) => {
      makeServer.listen(0, "127.0.0.1", () => {
        const { port } = makeServer.address();
        resolve(`http://127.0.0.1:${port}`);
      });
    });

    const app = createApp({
      webhookUrl: makeUrl,
      allowedOrigins: ["https://empoweringdavid.com"],
    });
    ({ server: appServer, url: appUrl } = await listen(app));
  });

  after(async () => {
    await close(appServer);
    await close(makeServer);
  });

  it("forwards JSON to Make and returns CORS headers", async () => {
    const response = await fetch(`${appUrl}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://empoweringdavid.com",
      },
      body: JSON.stringify(validBody),
    });

    assert.equal(response.status, 200);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://empoweringdavid.com");
    assert.deepEqual(await response.json(), { ok: true });
    assert.equal(received.length, 1);
    assert.equal(received[0].contentType, "application/json");
    assert.equal(received[0].body.name, "Ada Lovelace");
    assert.equal(received[0].body.businessName, "Analytical Engines");
    assert.match(received[0].body.submittedAt, /^\d{4}-\d{2}-\d{2}T/);
  });

  it("returns 400 for invalid input without calling Make", async () => {
    const before = received.length;
    const response = await fetch(`${appUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, email: "bad" }),
    });

    assert.equal(response.status, 400);
    assert.equal(received.length, before);
  });

  it("returns 200 and skips Make for honeypot traffic", async () => {
    const before = received.length;
    const response = await fetch(`${appUrl}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...validBody, website: "http://bots.test" }),
    });

    assert.equal(response.status, 200);
    assert.equal(received.length, before);
  });

  it("answers OPTIONS preflight for the live site origin", async () => {
    const response = await fetch(`${appUrl}/contact`, {
      method: "OPTIONS",
      headers: {
        Origin: "https://empoweringdavid.com",
        "Access-Control-Request-Method": "POST",
      },
    });

    assert.equal(response.status, 204);
    assert.equal(response.headers.get("access-control-allow-origin"), "https://empoweringdavid.com");
  });
});

describe("POST /contact without MAKE_WEBHOOK_URL", () => {
  let server;
  let url;

  before(async () => {
    ({ server, url } = await listen(createApp({ webhookUrl: "", allowedOrigins: [] })));
  });

  after(async () => {
    await close(server);
  });

  it("returns 503", async () => {
    const response = await fetch(`${url}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    assert.equal(response.status, 503);
  });
});

describe("duplicate submissions", () => {
  const received = [];
  let makeServer;
  let appServer;
  let appUrl;

  before(async () => {
    makeServer = createServer((req, res) => {
      let body = "";
      req.on("data", (chunk) => {
        body += chunk;
      });
      req.on("end", () => {
        received.push(JSON.parse(body));
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("Accepted");
      });
    });

    const makeUrl = await new Promise((resolve) => {
      makeServer.listen(0, "127.0.0.1", () => {
        const { port } = makeServer.address();
        resolve(`http://127.0.0.1:${port}`);
      });
    });

    const app = createApp({
      webhookUrl: makeUrl,
      allowedOrigins: ["https://empoweringdavid.com"],
    });
    ({ server: appServer, url: appUrl } = await listen(app));
  });

  after(async () => {
    await close(appServer);
    await close(makeServer);
  });

  it("treats formatted phone numbers as the same number", () => {
    assert.equal(normalizePhone("412-555-0100"), "4125550100");
    assert.equal(normalizePhone("1 (412) 555-0100"), "4125550100");
    assert.equal(
      contactKey("Ada@Example.com", "412-555-0100"),
      contactKey("ada@example.com", "14125550100"),
    );
  });

  it("rejects a second submit from the same IP", async () => {
    const first = await fetch(`${appUrl}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.10",
      },
      body: JSON.stringify(validBody),
    });
    assert.equal(first.status, 200);

    const second = await fetch(`${appUrl}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "203.0.113.10",
      },
      body: JSON.stringify({
        ...validBody,
        email: "other@example.com",
        phone: "412-555-0199",
      }),
    });
    const body = await second.json();

    assert.equal(second.status, 409);
    assert.equal(body.error, "This request was already sent.");
    assert.equal(received.length, 1);
  });

  it("rejects the same email and phone from a different IP", async () => {
    const response = await fetch(`${appUrl}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.20",
      },
      body: JSON.stringify({
        ...validBody,
        phone: "1 (412) 555-0100",
        email: "ADA@example.com",
      }),
    });
    const body = await response.json();

    assert.equal(response.status, 409);
    assert.equal(body.error, "This request was already sent.");
    assert.equal(received.length, 1);
  });

  it("allows a different IP with different contact info", async () => {
    const response = await fetch(`${appUrl}/contact`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Forwarded-For": "198.51.100.21",
      },
      body: JSON.stringify({
        ...validBody,
        email: "priya@example.com",
        phone: "412-555-0111",
      }),
    });

    assert.equal(response.status, 200);
    assert.equal(received.length, 2);
  });
});

describe("failed delivery is not remembered as a duplicate", () => {
  let server;
  let url;

  before(async () => {
    const app = createApp({
      webhookUrl: "http://127.0.0.1:9",
      allowedOrigins: [],
      forwardWebhook: async () => ({ ok: false, status: 500 }),
    });
    ({ server, url } = await listen(app));
  });

  after(async () => {
    await close(server);
  });

  it("allows a retry after Make fails", async () => {
    const first = await fetch(`${url}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    assert.equal(first.status, 502);

    const second = await fetch(`${url}/contact`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(validBody),
    });
    assert.equal(second.status, 502);
  });
});

describe("GET /health", () => {
  let server;
  let url;

  before(async () => {
    ({ server, url } = await listen(createApp({ webhookUrl: "http://example.test" })));
  });

  after(async () => {
    await close(server);
  });

  it("returns ok", async () => {
    const response = await fetch(`${url}/health`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});
