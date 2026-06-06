// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { dynamic, GET } from "@/app/api/health/route";

const REQUIRED_ENV = [
  "AI_BASE_URL",
  "AI_API_KEY",
  "AI_MODEL",
  "SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "APP_ACCESS_SECRET",
] as const;

const OPTIONAL_ENV = ["MEMBERSHIP_CODE_SECRET"] as const;

const originalEnv = { ...process.env };

function resetHealthEnv() {
  for (const name of [...REQUIRED_ENV, ...OPTIONAL_ENV]) {
    delete process.env[name];
  }
  process.env.NODE_ENV = "test";
}

describe("health route", () => {
  beforeEach(() => {
    resetHealthEnv();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("is evaluated dynamically so deploy checks use runtime env", () => {
    expect(dynamic).toBe("force-dynamic");
  });

  it("returns ok with boolean-only configuration checks when required env is present", async () => {
    for (const name of REQUIRED_ENV) {
      process.env[name] = `${name.toLowerCase()}-value`;
    }
    process.env.MEMBERSHIP_CODE_SECRET = "membership-secret";

    const response = await GET();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    await expect(response.json()).resolves.toEqual({
      ok: true,
      service: "aiweb",
      version: "0.1.0",
      environment: "test",
      checks: {
        aiBaseUrlConfigured: true,
        aiApiKeyConfigured: true,
        aiModelConfigured: true,
        supabaseUrlConfigured: true,
        supabaseServiceRoleKeyConfigured: true,
        appAccessSecretConfigured: true,
        membershipCodeSecretConfigured: true,
      },
    });
  });

  it("returns 503 and never leaks configured secret values when required env is missing", async () => {
    process.env.AI_API_KEY = "real-ai-secret";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "real-supabase-secret";
    process.env.APP_ACCESS_SECRET = "real-cookie-secret";
    process.env.MEMBERSHIP_CODE_SECRET = "real-membership-secret";

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.ok).toBe(false);
    expect(payload.checks).toMatchObject({
      aiBaseUrlConfigured: false,
      aiApiKeyConfigured: true,
      aiModelConfigured: false,
      supabaseUrlConfigured: false,
      supabaseServiceRoleKeyConfigured: true,
      appAccessSecretConfigured: true,
      membershipCodeSecretConfigured: true,
    });
    expect(JSON.stringify(payload)).not.toContain("real-ai-secret");
    expect(JSON.stringify(payload)).not.toContain("real-supabase-secret");
    expect(JSON.stringify(payload)).not.toContain("real-cookie-secret");
    expect(JSON.stringify(payload)).not.toContain("real-membership-secret");
  });
});
