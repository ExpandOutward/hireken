import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createApp } from "./app.js";

const root = dirname(fileURLToPath(import.meta.url));
const envPath = join(root, ".env");

if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

const port = Number(process.env.PORT) || 3000;
const webhookUrl = (process.env.MAKE_WEBHOOK_URL || "").trim();
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim().replace(/\/$/, ""))
  .filter(Boolean);

if (allowedOrigins.length === 0) {
  allowedOrigins.push(
    "https://empoweringdavid.com",
    "https://www.empoweringdavid.com",
    "https://expandoutward.github.io",
  );
}

const hours = Number(process.env.DUPLICATE_WINDOW_HOURS);
const duplicateWindowMs =
  (Number.isFinite(hours) && hours > 0 ? hours : 24) * 60 * 60 * 1000;

const app = createApp({ webhookUrl, allowedOrigins, duplicateWindowMs });

app.listen(port, () => {
  console.log(`Contact API listening on ${port}`);
  if (webhookUrl) {
    console.log("Make webhook enabled");
  } else {
    console.log("MAKE_WEBHOOK_URL not set; POST /contact will return 503");
  }
});
