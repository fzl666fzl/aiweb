# Membership Recharge Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a recharge button and modal that sends users to 链动小铺 for purchase, then lets them redeem auto-delivered membership codes on this site.

**Architecture:** 链动小铺 handles payment and code delivery. The app stores hashed membership codes, exposes a protected redeem route, computes effective membership with expiration, and shows the recharge flow in the existing membership section.

**Tech Stack:** Next.js 16 App Router route handlers, React 19 client components, Supabase/Postgres migrations, Vitest and Testing Library, Node script for code generation.

---

### Task 1: Membership Expiration Policy

**Files:**
- Modify: `src/lib/membership.ts`
- Test: `tests/unit/membership.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests for effective tier and expiry:

```ts
import { getEffectiveMembershipTier } from "@/lib/membership";

it("keeps paid tiers active before expiration", () => {
  expect(getEffectiveMembershipTier("pro", "2026-06-30T00:00:00.000Z", new Date("2026-06-01T00:00:00.000Z")).id).toBe("pro");
});

it("falls back to Free after membership expiration", () => {
  expect(getEffectiveMembershipTier("plus", "2026-05-01T00:00:00.000Z", new Date("2026-06-01T00:00:00.000Z")).id).toBe("free");
});
```

Run: `npx vitest run tests/unit/membership.test.ts`

Expected: FAIL because `getEffectiveMembershipTier` does not exist.

- [ ] **Step 2: Implement policy**

Add `getEffectiveMembershipTier(tier, expiresAt, now)` that returns Free when the tier is Free, expiresAt is missing, invalid, or not in the future; otherwise returns the paid tier.

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/unit/membership.test.ts`

Expected: PASS.

### Task 2: Database Schema

**Files:**
- Modify: `supabase/schema.sql`
- Modify: `supabase/migrations/202605250001_add_membership_tiers.sql`

- [ ] **Step 1: Extend schema**

Add `membership_expires_at timestamptz` to `app_users`.

Create `membership_codes` with `code_hash`, `tier`, `duration_days`, `redeemed_by_user_id`, `redeemed_at`, `created_at`, and indexes.

- [ ] **Step 2: Keep migration idempotent**

Use `add column if not exists`, `create table if not exists`, and `create index if not exists`.

### Task 3: `/api/me` and Chat Quota Use Effective Membership

**Files:**
- Modify: `src/app/api/me/route.ts`
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/components/SessionProvider.tsx`
- Test: `tests/unit/me-route.test.ts`
- Test: `tests/unit/chat-route.test.ts`

- [ ] **Step 1: Write failing tests**

Update mocks and assertions so `/api/me` selects `id, email, membership_tier, membership_expires_at`, returns `membership.expiresAt`, and treats expired Plus as Free.

Add chat test: account row `{ membership_tier: "plus", membership_expires_at: "2026-01-01T00:00:00.000Z" }` uses Free limit 50.

Run: `npx vitest run tests/unit/me-route.test.ts tests/unit/chat-route.test.ts`

Expected: FAIL because current code ignores expiration.

- [ ] **Step 2: Implement**

Use `getEffectiveMembershipTier` in both routes. Include `expiresAt` in `MembershipSummary`.

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/unit/me-route.test.ts tests/unit/chat-route.test.ts`

Expected: PASS.

### Task 4: Redeem API

**Files:**
- Create: `src/app/api/membership/redeem/route.ts`
- Test: `tests/unit/membership-redeem-route.test.ts`

- [ ] **Step 1: Write failing tests**

Cover:

- unauthenticated returns 401
- empty code returns 400
- invalid or used code returns 400
- valid Plus code updates `app_users`, marks code redeemed, and returns membership summary

Run: `npx vitest run tests/unit/membership-redeem-route.test.ts`

Expected: FAIL because route does not exist.

- [ ] **Step 2: Implement route**

Use `hashAccessCode(code, MEMBERSHIP_CODE_SECRET)`, falling back to `APP_ACCESS_SECRET` only when the dedicated membership secret is not configured. Use `requireSession` and Supabase admin. Query current user by `access_key_id`, query unused code by hash, calculate expiry, update user, mark code used, and return membership summary.

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/unit/membership-redeem-route.test.ts`

Expected: PASS.

### Task 5: Code Generation Script

**Files:**
- Create: `scripts/generate-membership-codes.mjs`
- Test: `tests/unit/generate-membership-codes.test.ts`

- [ ] **Step 1: Write failing test**

Run the script with `node scripts/generate-membership-codes.mjs plus 2 --secret test-secret` and assert stdout contains two `AIWEB-PLUS-` codes and SQL insert rows with 64-char hashes.

- [ ] **Step 2: Implement script**

Validate tier `plus|pro`, count `1..500`, optional `--secret`, default duration `31`, output code lines and SQL. Do not write files.

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/unit/generate-membership-codes.test.ts`

Expected: PASS.

### Task 6: Recharge Modal UI

**Files:**
- Modify: `src/components/MembershipPlans.tsx`
- Test: `tests/unit/membership-plans.test.tsx`

- [ ] **Step 1: Write failing tests**

Assert:

- default render shows `充值 / 升级` button
- cards are not shown until button click
- modal contains Plus/Pro purchase links, redeem input, and submit button
- submitting a code calls `/api/membership/redeem` and then `refresh`

Run: `npx vitest run tests/unit/membership-plans.test.tsx`

Expected: FAIL because current component always shows cards and has no modal.

- [ ] **Step 2: Implement UI**

Make `MembershipPlans` a client component. Keep section compact, add modal with accessible dialog, close button, purchase links from `NEXT_PUBLIC_LDXP_PLUS_URL` and `NEXT_PUBLIC_LDXP_PRO_URL` with the current production links as fallbacks, redeem form, loading and error states. Use `apiJson` and `useSession().refresh()`.

- [ ] **Step 3: Verify**

Run: `npx vitest run tests/unit/membership-plans.test.tsx tests/unit/HomePage.test.tsx`

Expected: PASS.

### Task 7: Final Verification

- [ ] Run `npm test`.
- [ ] Run `npm run lint`.
- [ ] Run `npm run build`.
- [ ] Run a local browser smoke test or Playwright smoke test to verify the membership section and modal render.
- [ ] Inspect `git status --short` and `git diff --stat`.
