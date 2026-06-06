const CLOUDFLARE_API = "https://api.cloudflare.com/client/v4";
const TARGET_IP = "43.133.240.199";
const RECORDS = ["fzl-ai.top", "www.fzl-ai.top"];

const token = process.env.CLOUDFLARE_API_TOKEN ?? process.env.CF_API_TOKEN;
const zoneId = process.env.CLOUDFLARE_ZONE_ID ?? process.env.CF_ZONE_ID;

if (!token || !zoneId) {
  console.error("Missing CLOUDFLARE_API_TOKEN and CLOUDFLARE_ZONE_ID.");
  console.error("Export them temporarily, then run: node deployment/cloudflare-aiweb-dns-cutover.mjs");
  process.exit(1);
}

async function cloudflare(path, init = {}) {
  const response = await fetch(`${CLOUDFLARE_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  const body = await response.json();

  if (!response.ok || !body.success) {
    throw new Error(JSON.stringify({ status: response.status, errors: body.errors }, null, 2));
  }

  return body.result;
}

async function findARecord(name) {
  const params = new URLSearchParams({ name, type: "A" });
  const records = await cloudflare(`/zones/${zoneId}/dns_records?${params}`);
  return records[0] ?? null;
}

async function upsertARecord(name) {
  const payload = {
    comment: "aiweb Tencent Lighthouse cutover",
    content: TARGET_IP,
    name,
    proxied: true,
    ttl: 1,
    type: "A",
  };
  const existing = await findARecord(name);

  if (existing) {
    await cloudflare(`/zones/${zoneId}/dns_records/${existing.id}`, {
      body: JSON.stringify(payload),
      method: "PUT",
    });
    console.log(`updated ${name} -> ${TARGET_IP} proxied=true`);
    return;
  }

  await cloudflare(`/zones/${zoneId}/dns_records`, {
    body: JSON.stringify(payload),
    method: "POST",
  });
  console.log(`created ${name} -> ${TARGET_IP} proxied=true`);
}

for (const name of RECORDS) {
  await upsertARecord(name);
}

console.log("DNS cutover submitted. Do not change api routes.");
