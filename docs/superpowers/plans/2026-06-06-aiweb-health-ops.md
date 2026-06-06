# Aiweb Health Ops Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe production health endpoint and wire it into the Tencent Lighthouse deployment assets so the frontend container can be verified without exposing secrets.

**Architecture:** Implement a small App Router Route Handler at `/api/health` that returns service identity, package version, environment, and boolean-only configuration checks. Keep the endpoint side-effect free and avoid database or upstream model calls so it can serve as a fast liveness/configuration smoke test. Connect Docker Compose `healthcheck` to the endpoint and document server/public smoke commands in the deployment runbook.

**Tech Stack:** Next.js 16 App Router route handlers, Vitest unit tests, Docker Compose v2, Node 22 runtime fetch.

---

### Task 1: Health Route Contract

**Files:**
- Create: `tests/unit/health-route.test.ts`
- Create: `src/app/api/health/route.ts`

- [ ] **Step 1: Write the failing test**

```ts
// @vitest-environment node

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GET } from "@/app/api/health/route";

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

  it("returns ok with boolean-only configuration checks when required env is present", async () => {
    for (const name of REQUIRED_ENV) {
      process.env[name] = `${name.toLowerCase()}-value`;
    }
    process.env.MEMBERSHIP_CODE_SECRET = "membership-secret";

    const response = await GET();

    expect(response.status).toBe(200);
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/health-route.test.ts`

Expected: FAIL because `src/app/api/health/route.ts` does not exist yet.

- [ ] **Step 3: Write minimal implementation**

Create a route handler that:

```ts
import packageJson from "../../../../package.json";

type HealthChecks = {
  aiBaseUrlConfigured: boolean;
  aiApiKeyConfigured: boolean;
  aiModelConfigured: boolean;
  supabaseUrlConfigured: boolean;
  supabaseServiceRoleKeyConfigured: boolean;
  appAccessSecretConfigured: boolean;
  membershipCodeSecretConfigured: boolean;
};

function hasEnv(name: string) {
  return Boolean(process.env[name]?.trim());
}

export async function GET() {
  const checks: HealthChecks = {
    aiBaseUrlConfigured: hasEnv("AI_BASE_URL"),
    aiApiKeyConfigured: hasEnv("AI_API_KEY"),
    aiModelConfigured: hasEnv("AI_MODEL"),
    supabaseUrlConfigured: hasEnv("SUPABASE_URL"),
    supabaseServiceRoleKeyConfigured: hasEnv("SUPABASE_SERVICE_ROLE_KEY"),
    appAccessSecretConfigured: hasEnv("APP_ACCESS_SECRET"),
    membershipCodeSecretConfigured: hasEnv("MEMBERSHIP_CODE_SECRET"),
  };
  const requiredChecks: Array<keyof HealthChecks> = [
    "aiBaseUrlConfigured",
    "aiApiKeyConfigured",
    "aiModelConfigured",
    "supabaseUrlConfigured",
    "supabaseServiceRoleKeyConfigured",
    "appAccessSecretConfigured",
  ];
  const ok = requiredChecks.every((name) => checks[name]);

  return Response.json(
    {
      ok,
      service: "aiweb",
      version: packageJson.version,
      environment: process.env.NODE_ENV ?? "development",
      checks,
    },
    { status: ok ? 200 : 503 },
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/health-route.test.ts`

Expected: PASS.

### Task 2: Deployment Healthcheck And Smoke Tests

**Files:**
- Modify: `deployment/docker-compose.aiweb.yml`
- Modify: `deployment/preflight-aiweb.sh`
- Modify: `docs/deployment/tencent-lighthouse-aiweb.md`
- Modify: `tests/unit/deployment-assets.test.ts`

- [ ] **Step 1: Write failing deployment asset expectations**

Add assertions that:

```ts
expect(compose).toContain("healthcheck:");
expect(compose).toContain("http://127.0.0.1:3000/api/health");
expect(runbook).toContain("https://fzl-ai.top/api/health");
expect(script).toContain("https://fzl-ai.top/api/health");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/deployment-assets.test.ts`

Expected: FAIL because the compose file and docs do not mention `/api/health` yet.

- [ ] **Step 3: Add Docker healthcheck and smoke documentation**

Add a Compose healthcheck using Node 22 fetch:

```yaml
    healthcheck:
      test:
        - CMD
        - node
        - -e
        - "fetch('http://127.0.0.1:3000/api/health').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

Update preflight/runbook smoke commands to include:

```bash
docker exec aiweb node -e "fetch('http://127.0.0.1:3000/api/health').then(async (response) => { console.log(response.status, await response.text()); process.exit(response.ok ? 0 : 1); }).catch((error) => { console.error(error); process.exit(1); })"
curl -fsS https://fzl-ai.top/api/health
```

- [ ] **Step 4: Run deployment asset test**

Run: `npm test -- tests/unit/deployment-assets.test.ts`

Expected: PASS.

### Task 3: Full Verification

**Files:**
- All changed files

- [ ] **Step 1: Run targeted tests**

Run:

```powershell
npm test -- tests/unit/health-route.test.ts tests/unit/deployment-assets.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full verification**

Run:

```powershell
npm test
npm run lint
npm run build
git diff --check
```

Expected: all commands exit 0. `git diff --check` may print Windows LF/CRLF warnings but must not report whitespace errors.

- [ ] **Step 3: Summarize merge-ready diff**

Report:
- New health endpoint behavior and safety constraints.
- Docker/Cloudflare/Caddy smoke-test commands.
- Any verification command that failed and how it was fixed.
- Any local limitation, especially Docker CLI availability on this Windows host.
