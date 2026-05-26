import { createHmac, randomBytes } from "node:crypto";

const VALID_TIERS = new Set(["plus", "pro"]);
const DEFAULT_DURATION_DAYS = 31;
const MAX_COUNT = 500;

function usage() {
  console.error("Usage: node scripts/generate-membership-codes.mjs <plus|pro> <count> [--secret APP_ACCESS_SECRET] [--duration-days 31]");
}

function readOption(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] ?? null;
}

const tier = process.argv[2];
const count = Number(process.argv[3]);
const secret = readOption("--secret") ?? process.env.APP_ACCESS_SECRET;
const durationDays = Number(readOption("--duration-days") ?? DEFAULT_DURATION_DAYS);

if (!VALID_TIERS.has(tier) || !Number.isInteger(count) || count < 1 || count > MAX_COUNT) {
  usage();
  process.exit(1);
}

if (!secret) {
  console.error("Missing APP_ACCESS_SECRET. Pass --secret or set the environment variable.");
  process.exit(1);
}

if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 366) {
  console.error("duration-days must be an integer between 1 and 366.");
  process.exit(1);
}

function hashCode(code) {
  return createHmac("sha256", secret).update(code.trim(), "utf8").digest("hex");
}

function createCode() {
  return `AIWEB-${tier.toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

const codes = Array.from({ length: count }, createCode);

console.log("-- Copy these codes into 链动小铺 automatic delivery:");
for (const code of codes) {
  console.log(code);
}

console.log("\n-- Run this SQL in Supabase before selling the codes:");
console.log("insert into membership_codes (code_hash, tier, duration_days) values");
console.log(
  codes
    .map((code, index) => {
      const suffix = index === codes.length - 1 ? ";" : ",";
      return `  ('${hashCode(code)}', '${tier}', ${durationDays})${suffix}`;
    })
    .join("\n"),
);
