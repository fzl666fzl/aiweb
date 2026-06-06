# Membership Limits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Free, Plus, and Pro membership tiers for registered accounts, with different monthly chat message limits enforced by the backend and shown in the UI.

**Architecture:** Keep membership policy in a small shared TypeScript module, store the selected tier on `app_users`, and reuse the existing `usage_logs` plus `increment_usage_if_allowed` RPC by recording account quota usage against the current Shanghai month start date. Access-code users keep the old daily `access_keys.daily_limit` path.

**Tech Stack:** Next.js 16 App Router route handlers, React 19 client components, Supabase/Postgres migrations, Vitest unit tests, Tailwind CSS 4 utility classes.

---

### Task 1: Shared Membership Policy

**Files:**
- Create: `src/lib/membership.ts`
- Test: `tests/unit/membership.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEMBERSHIP_TIER_ID,
  getMembershipTier,
  getMembershipUsagePeriod,
  parseMembershipTierId,
} from "@/lib/membership";

describe("membership policy", () => {
  it("defaults unknown tiers to Free", () => {
    expect(parseMembershipTierId("enterprise")).toBe(DEFAULT_MEMBERSHIP_TIER_ID);
    expect(getMembershipTier("enterprise").monthlyMessageLimit).toBe(50);
  });

  it("defines different monthly message limits for Free, Plus, and Pro", () => {
    expect(getMembershipTier("free").monthlyMessageLimit).toBe(50);
    expect(getMembershipTier("plus").monthlyMessageLimit).toBe(500);
    expect(getMembershipTier("pro").monthlyMessageLimit).toBe(2000);
  });

  it("uses the Asia/Shanghai month start as the usage bucket", () => {
    expect(getMembershipUsagePeriod(new Date("2026-05-31T16:30:00.000Z")).usageDate).toBe("2026-06-01");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/membership.test.ts`

Expected: FAIL because `@/lib/membership` does not exist.

- [ ] **Step 3: Implement the membership policy module**

```ts
export const DEFAULT_MEMBERSHIP_TIER_ID = "free";

export const MEMBERSHIP_TIERS = [
  {
    id: "free",
    name: "Free",
    priceLabel: "¥0 / 月",
    description: "默认档位，适合偶尔使用。",
    monthlyMessageLimit: 50,
    benefits: ["每月 50 次 AI 对话", "可使用所有已开放入口", "保存账号下的历史会话"],
  },
  {
    id: "plus",
    name: "Plus",
    priceLabel: "¥19 / 月",
    description: "适合日常学习和稳定使用。",
    monthlyMessageLimit: 500,
    benefits: ["每月 500 次 AI 对话", "包含 Free 的全部权益", "适合复习助手和多场景连续使用"],
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "¥49 / 月",
    description: "适合重度用户和小团队预留。",
    monthlyMessageLimit: 2000,
    benefits: ["每月 2000 次 AI 对话", "包含 Plus 的全部权益", "适合高频对话和密集复习周期"],
    highlighted: true,
  },
] as const;

export type MembershipTierId = (typeof MEMBERSHIP_TIERS)[number]["id"];

export function parseMembershipTierId(value: unknown): MembershipTierId {
  return MEMBERSHIP_TIERS.some((tier) => tier.id === value) ? (value as MembershipTierId) : DEFAULT_MEMBERSHIP_TIER_ID;
}

export function getMembershipTier(value: unknown) {
  const tierId = parseMembershipTierId(value);
  return MEMBERSHIP_TIERS.find((tier) => tier.id === tierId) ?? MEMBERSHIP_TIERS[0];
}

export function getMembershipUsagePeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";

  return { usageDate: `${year}-${month}-01`, label: `${year}-${month}` };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/membership.test.ts`

Expected: PASS.

### Task 2: Account API Membership Data

**Files:**
- Modify: `src/app/api/me/route.ts`
- Modify: `src/components/SessionProvider.tsx`
- Test: `tests/unit/me-route.test.ts`

- [ ] **Step 1: Write the failing route test**

Add to `tests/unit/me-route.test.ts`:

```ts
it("returns membership tier and monthly usage for the current account", async () => {
  usageResult = { data: { request_count: 7 }, error: null };
  userResult = { data: { email: "user@qq.com", membership_tier: "plus" }, error: null };

  const response = await GET();

  expect(response.status).toBe(200);
  expect(usageFilters).toContainEqual(["access_key_id", "access-1"]);
  expect(usageFilters).toContainEqual(["visitor_id", "user:user-1"]);
  expect(usageFilters.find(([column]) => column === "usage_date")?.[1]).toMatch(/^\d{4}-\d{2}-01$/);
  await expect(response.json()).resolves.toEqual({
    user: {
      email: "user@qq.com",
      membership: {
        tierId: "plus",
        name: "Plus",
        monthlyMessageLimit: 500,
        monthlyMessagesUsed: 7,
        monthlyMessagesRemaining: 493,
        periodLabel: expect.stringMatching(/^\d{4}-\d{2}$/),
      },
    },
  });
});
```

Also update the Supabase mock so `app_users` and `usage_logs` are both supported.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/me-route.test.ts`

Expected: FAIL because `/api/me` only returns email.

- [ ] **Step 3: Implement `/api/me` membership payload**

Update `GET()` to select `email, membership_tier`, derive the tier with `getMembershipTier`, query `usage_logs` for the current month bucket and current visitor, and return:

```ts
{
  user: {
    email: data.email,
    membership: {
      tierId: tier.id,
      name: tier.name,
      monthlyMessageLimit: tier.monthlyMessageLimit,
      monthlyMessagesUsed,
      monthlyMessagesRemaining: Math.max(tier.monthlyMessageLimit - monthlyMessagesUsed, 0),
      periodLabel: period.label,
    },
  },
}
```

Update `CurrentUser` in `SessionProvider.tsx` to include the same `membership` shape.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/me-route.test.ts`

Expected: PASS.

### Task 3: Backend Quota Enforcement

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Modify: `src/app/api/auth/route.ts`
- Test: `tests/unit/chat-route.test.ts`
- Test: `tests/unit/auth-route.test.ts`

- [ ] **Step 1: Write failing chat quota tests**

Add tests that prove:

```ts
it("uses account membership monthly quota instead of access key daily quota", async () => {
  accountMembershipTier = "plus";

  const response = await POST(new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({ message: "你好" }),
  }));

  expect(response.status).toBe(200);
  await response.text();
  expect(rpcCalls[0]).toMatchObject({
    name: "increment_usage_if_allowed",
    args: {
      p_access_key_id: "access-1",
      p_visitor_id: "visitor-1",
      p_access_limit: 500,
      p_visitor_limit: 500,
    },
  });
  expect(String(rpcCalls[0].args.p_usage_date)).toMatch(/^\d{4}-\d{2}-01$/);
});

it("returns a membership-specific message when the monthly quota is reached", async () => {
  accountMembershipTier = "free";
  quotaAllowed = false;

  const response = await POST(new Request("http://localhost/api/chat", {
    method: "POST",
    body: JSON.stringify({ message: "你好" }),
  }));

  expect(response.status).toBe(429);
  await expect(response.json()).resolves.toEqual({
    error: "本月 Free 会员的 50 次提问额度已经用完了。可联系管理员升级会员，或下月再继续使用。",
  });
});
```

Update mocks so `app_users` can return an account row by `access_key_id`.

- [ ] **Step 2: Write failing registration test**

Extend `tests/unit/auth-route.test.ts` account registration assertion:

```ts
expect(queries.find((query) => query.table === "app_users" && query.inserted)?.inserted).toMatchObject({
  access_key_id: "access-account-1",
  email: "user@qq.com",
  membership_tier: "free",
});
```

Run: `npx vitest run tests/unit/chat-route.test.ts tests/unit/auth-route.test.ts`

Expected: FAIL because chat route only reads `access_keys.daily_limit` and registration does not set a membership tier.

- [ ] **Step 3: Implement backend quota resolution**

In `src/app/api/chat/route.ts`, replace `enforceDailyLimit` with logic that:

1. Confirms the access key is enabled.
2. Looks for an enabled `app_users` row by `access_key_id`.
3. If found, parses `membership_tier`, uses monthly tier limit and `getMembershipUsagePeriod().usageDate`.
4. If not found, keeps the existing access-code daily limit behavior.
5. Calls `increment_usage_if_allowed` with the selected limit.
6. Returns the existing daily error for access-code users and the new membership monthly error for account users.

In `src/app/api/auth/route.ts`, set `membership_tier: DEFAULT_MEMBERSHIP_TIER_ID` when inserting registered accounts.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/unit/chat-route.test.ts tests/unit/auth-route.test.ts`

Expected: PASS.

### Task 4: Supabase Schema and Migration

**Files:**
- Modify: `supabase/schema.sql`
- Create: `supabase/migrations/202605250001_add_membership_tiers.sql`

- [ ] **Step 1: Add migration**

```sql
alter table app_users
  add column if not exists membership_tier text not null default 'free';

alter table app_users
  drop constraint if exists app_users_membership_tier_check;

alter table app_users
  add constraint app_users_membership_tier_check
  check (membership_tier in ('free', 'plus', 'pro'));
```

- [ ] **Step 2: Update base schema**

Add `membership_tier text not null default 'free'` to `app_users` and the same check constraint in `supabase/schema.sql`.

- [ ] **Step 3: Verify migration syntax by inspection and full test suite**

Run: `npm test`

Expected: PASS.

### Task 5: Membership UI

**Files:**
- Create: `src/components/MembershipPlans.tsx`
- Modify: `src/components/HomeContent.tsx`
- Modify: `src/components/AccountMenu.tsx`

- [ ] **Step 1: Write a focused component test**

Create `tests/unit/membership-plans.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MembershipPlans } from "@/components/MembershipPlans";

describe("MembershipPlans", () => {
  it("renders all tiers and highlights the current tier usage", () => {
    render(
      <MembershipPlans
        currentTierId="plus"
        usage={{
          tierId: "plus",
          name: "Plus",
          monthlyMessageLimit: 500,
          monthlyMessagesUsed: 12,
          monthlyMessagesRemaining: 488,
          periodLabel: "2026-05",
        }}
      />,
    );

    expect(screen.getByRole("heading", { name: "会员额度" })).toBeInTheDocument();
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Plus")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("本月已用 12 / 500")).toBeInTheDocument();
    expect(screen.getByText("当前会员")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/membership-plans.test.tsx`

Expected: FAIL because `MembershipPlans` does not exist.

- [ ] **Step 3: Implement the UI**

Create a compact, responsive card grid using the existing stone/emerald palette. Keep the card radius at `rounded-lg`, use text labels for current tier and quota, and avoid any payment claim beyond “联系管理员开通”.

Update `HomeContent` to read `useSession()`, render `<MembershipPlans currentTierId={user?.membership.tierId} usage={user?.membership} />`, and add a nav anchor for membership.

Update `AccountMenu` to show a small tier badge and usage text:

```tsx
const membership = user?.membership;
...
{membership ? (
  <span className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
    {membership.name}
  </span>
) : null}
{membership && !compact ? (
  <span className="text-xs text-stone-500">
    本月 {membership.monthlyMessagesUsed}/{membership.monthlyMessageLimit}
  </span>
) : null}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/membership-plans.test.tsx`

Expected: PASS.

### Task 6: Final Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run unit tests**

Run: `npm test`

Expected: all test files pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: exit code 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: exit code 0.

- [ ] **Step 4: Inspect git diff**

Run: `git diff --stat` and `git status --short`

Expected: changes are limited to membership policy, API routes, UI components, tests, Supabase schema/migration, and this plan document. Existing untracked `submission-proof/` remains untouched.
