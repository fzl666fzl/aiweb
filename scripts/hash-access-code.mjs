import { createHmac } from "node:crypto";

const [label, code] = process.argv.slice(2);
const secret = process.env.APP_ACCESS_SECRET;

if (!label || !code || !secret) {
  console.error("Usage: APP_ACCESS_SECRET=... npm run access-code -- <label> <code>");
  process.exit(1);
}

const hash = createHmac("sha256", secret).update(code.trim(), "utf8").digest("hex");
const safeLabel = label.replaceAll("'", "''");

console.log(`insert into access_keys (label, key_hash, enabled, daily_limit)
values ('${safeLabel}', '${hash}', true, 100);`);
