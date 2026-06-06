# Aiweb Security Headers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add conservative production HTTP security headers to the Next.js app without breaking chat, membership purchase links, or the Tencent Lighthouse/Caddy deployment path.

**Architecture:** Use the Next.js `headers()` config hook in `next.config.ts` to attach browser hardening headers to every route. Keep the set intentionally conservative: MIME sniffing protection, referrer trimming, feature permission denial, clickjacking protection, and HTTPS-only HSTS. Do not add Content-Security-Policy in this pass because the app has Next.js runtime scripts, external purchase links, and model/API traffic that need a separate CSP audit.

**Tech Stack:** Next.js 16 `next.config.ts`, Vitest static config tests, deployment runbook docs.

---

### Task 1: Security Header Contract

**Files:**
- Modify: `tests/unit/deployment-assets.test.ts`
- Modify: `next.config.ts`

- [ ] **Step 1: Write failing expectations**

Extend `tests/unit/deployment-assets.test.ts` to assert `next.config.ts` contains:

```ts
expect(nextConfig).toContain("async headers()");
expect(nextConfig).toContain("X-Content-Type-Options");
expect(nextConfig).toContain("nosniff");
expect(nextConfig).toContain("Referrer-Policy");
expect(nextConfig).toContain("strict-origin-when-cross-origin");
expect(nextConfig).toContain("Permissions-Policy");
expect(nextConfig).toContain("camera=()");
expect(nextConfig).toContain("X-Frame-Options");
expect(nextConfig).toContain("DENY");
expect(nextConfig).toContain("Strict-Transport-Security");
expect(nextConfig).toContain("max-age=63072000; includeSubDomains; preload");
expect(nextConfig).not.toContain("Content-Security-Policy");
```

- [ ] **Step 2: Run focused test to verify it fails**

Run:

```powershell
npm test -- tests/unit/deployment-assets.test.ts
```

Expected: FAIL because `next.config.ts` does not define `headers()` yet.

- [ ] **Step 3: Implement conservative headers**

Add this helper and config hook to `next.config.ts`:

```ts
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), browsing-topics=()" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  // existing config...
};
```

- [ ] **Step 4: Run focused test to verify it passes**

Run:

```powershell
npm test -- tests/unit/deployment-assets.test.ts
```

Expected: PASS.

### Task 2: Deployment Documentation

**Files:**
- Modify: `docs/deployment/tencent-lighthouse-aiweb.md`
- Modify: `tests/unit/deployment-assets.test.ts`

- [ ] **Step 1: Add failing runbook expectation**

Assert the runbook documents security header checks:

```ts
expect(runbook).toContain("curl -I https://fzl-ai.top");
expect(runbook).toContain("Strict-Transport-Security");
expect(runbook).toContain("X-Content-Type-Options");
expect(runbook).toContain("Content-Security-Policy is intentionally not set");
```

- [ ] **Step 2: Run focused test to verify it fails if docs are missing**

Run:

```powershell
npm test -- tests/unit/deployment-assets.test.ts
```

Expected: FAIL until runbook has the new operator checks.

- [ ] **Step 3: Update runbook**

Add a short "Security Header Smoke Test" section near the existing smoke tests:

```bash
curl -I https://fzl-ai.top
```

Expected headers:

- `Strict-Transport-Security`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`
- `X-Frame-Options: DENY`

Mention: `Content-Security-Policy is intentionally not set in this pass; add it only after auditing Next runtime scripts, external purchase links, and model/API traffic.`

- [ ] **Step 4: Run focused test to verify it passes**

Run:

```powershell
npm test -- tests/unit/deployment-assets.test.ts
```

Expected: PASS.

### Task 3: Full Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test -- tests/unit/deployment-assets.test.ts
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

Expected: all commands exit 0. Windows LF/CRLF warnings are acceptable only when exit code is 0.

- [ ] **Step 3: Summarize impact**

Report:
- Header set and scope.
- Why CSP was not included.
- Verification results.
- Any Docker runtime limitation in the local Windows environment.
