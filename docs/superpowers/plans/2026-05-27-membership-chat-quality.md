# Membership Chat Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Plus and Pro feel better than Free by using longer chat context and tier-specific answer guidance while keeping every tier on the existing `AI_MODEL`.

**Architecture:** Add a focused chat quality policy module that maps an effective membership tier to context limits and a short experience prompt. Update `/api/chat` to resolve the effective tier once, apply the policy to history and study context, and keep the existing streaming/model path intact.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript, Vitest, Supabase client mocks.

---

### Task 1: Add Chat Quality Policy

**Files:**
- Create: `src/lib/chat-quality.ts`
- Test: `tests/unit/chat-quality.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/unit/chat-quality.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { getChatQualityPolicy } from "@/lib/chat-quality";

describe("chat quality policy", () => {
  it("keeps Free on the current compact context", () => {
    expect(getChatQualityPolicy("free")).toMatchObject({
      historyMessageLimit: 12,
      studyHistoryMessageLimit: 4,
      studyContextCharLimit: 8000,
      studyContextChunkLimit: 5,
    });
  });

  it("gives Plus a longer context and fuller answer guidance", () => {
    const policy = getChatQualityPolicy("plus");

    expect(policy).toMatchObject({
      historyMessageLimit: 48,
      studyHistoryMessageLimit: 12,
      studyContextCharLimit: 24000,
      studyContextChunkLimit: 10,
    });
    expect(policy.experiencePrompt).toContain("Plus");
    expect(policy.experiencePrompt).toContain("步骤");
    expect(policy.experiencePrompt).toContain("例子");
  });

  it("gives Pro the longest context and deeper answer guidance", () => {
    const policy = getChatQualityPolicy("pro");

    expect(policy).toMatchObject({
      historyMessageLimit: 96,
      studyHistoryMessageLimit: 20,
      studyContextCharLimit: 50000,
      studyContextChunkLimit: 18,
    });
    expect(policy.experiencePrompt).toContain("Pro");
    expect(policy.experiencePrompt).toContain("深入");
    expect(policy.experiencePrompt).toContain("前文");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/unit/chat-quality.test.ts
```

Expected: FAIL because `@/lib/chat-quality` does not exist.

- [ ] **Step 3: Write minimal implementation**

Create `src/lib/chat-quality.ts`:

```ts
import type { MembershipTierId } from "./membership";

export type ChatQualityPolicy = {
  experiencePrompt: string;
  historyMessageLimit: number;
  studyContextCharLimit: number;
  studyContextChunkLimit: number;
  studyHistoryMessageLimit: number;
};

const POLICIES: Record<MembershipTierId, ChatQualityPolicy> = {
  free: {
    experiencePrompt: "当前用户是 Free 档位。回答保持清楚、简洁、够用，不刻意拉长。",
    historyMessageLimit: 12,
    studyContextCharLimit: 8000,
    studyContextChunkLimit: 5,
    studyHistoryMessageLimit: 4,
  },
  plus: {
    experiencePrompt:
      "当前用户是 Plus 会员。回答可以更完整一些：优先给清晰步骤、必要例子和简短总结，帮助用户稳定推进。",
    historyMessageLimit: 48,
    studyContextCharLimit: 24000,
    studyContextChunkLimit: 10,
    studyHistoryMessageLimit: 12,
  },
  pro: {
    experiencePrompt:
      "当前用户是 Pro 会员。回答可以更深入、更有结构；适合长任务、长复习和多轮项目讨论，主动保留前文目标、约束和关键细节。",
    historyMessageLimit: 96,
    studyContextCharLimit: 50000,
    studyContextChunkLimit: 18,
    studyHistoryMessageLimit: 20,
  },
};

export function getChatQualityPolicy(tierId: MembershipTierId): ChatQualityPolicy {
  return POLICIES[tierId] ?? POLICIES.free;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test -- tests/unit/chat-quality.test.ts
```

Expected: PASS.

### Task 2: Apply Policy In Chat Route

**Files:**
- Modify: `src/app/api/chat/route.ts`
- Test: `tests/unit/chat-route.test.ts`

- [ ] **Step 1: Write failing route tests**

Update `tests/unit/chat-route.test.ts` with tests that set `accountMembership` and inspect the mocked Supabase `.limit()` count plus streamed AI options:

```ts
it("uses longer chat history and Plus guidance for Plus members", async () => {
  accountMembership = { membership_tier: "plus", membership_expires_at: "2999-01-01T00:00:00.000Z" };
  messageHistoryRows = Array.from({ length: 60 }, (_, index) => ({
    role: index % 2 === 0 ? "user" : "assistant",
    content: `history-${index + 1}`,
  }));

  await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "继续刚才的话题" }),
    }),
  );

  expect(messageHistoryLimitCalls).toContain(48);
  const [messages, options] = vi.mocked(streamChatCompletion).mock.calls[0];
  expect(options.model).toBe("test-model");
  expect(messages[0].content).toContain("Plus 会员");
  expect(messages.map((message) => message.content)).not.toContain("history-1");
});

it("uses the longest chat history and Pro guidance for Pro members", async () => {
  accountMembership = { membership_tier: "pro", membership_expires_at: "2999-01-01T00:00:00.000Z" };

  await POST(
    new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ message: "帮我继续规划" }),
    }),
  );

  expect(messageHistoryLimitCalls).toContain(96);
  const [messages, options] = vi.mocked(streamChatCompletion).mock.calls[0];
  expect(options.model).toBe("test-model");
  expect(messages[0].content).toContain("Pro 会员");
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npm test -- tests/unit/chat-route.test.ts
```

Expected: FAIL because `/api/chat` still uses fixed `CONTEXT_MESSAGE_LIMIT` and no membership experience prompt.

- [ ] **Step 3: Implement route policy application**

In `src/app/api/chat/route.ts`:

1. Import `getChatQualityPolicy`.
2. Let usage resolution return effective tier id.
3. Compute `const chatPolicy = getChatQualityPolicy(usage.value.tierId)`.
4. Use `chatPolicy.studyHistoryMessageLimit` or `chatPolicy.historyMessageLimit`.
5. Append `chatPolicy.experiencePrompt` to the existing persona system prompt.
6. Pass `chatPolicy.studyContextCharLimit` and `chatPolicy.studyContextChunkLimit` into `buildStudyContextMessage`.

- [ ] **Step 4: Run route tests**

Run:

```powershell
npm test -- tests/unit/chat-route.test.ts
```

Expected: PASS.

### Task 3: Verify Full Project

**Files:**
- No new files.

- [ ] **Step 1: Run all tests**

Run:

```powershell
npm test
```

Expected: all Vitest files pass.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm run lint
```

Expected: ESLint exits 0.

- [ ] **Step 3: Run production build**

Run:

```powershell
npm run build
```

Expected: Next.js build exits 0 and lists `/api/chat`.

### Task 4: Deploy

**Files:**
- No new files.

- [ ] **Step 1: Deploy to Vercel production**

Run:

```powershell
npx vercel deploy --prod
```

Expected: deployment succeeds and aliases `https://fzl-ai.top`.

- [ ] **Step 2: Smoke check `/api/me` and one chat request manually**

Open `https://fzl-ai.top`, log in with the test account, send a short chat as the current Plus account, and confirm the response streams normally.

---

## Self-Review

- Spec coverage: The plan implements same-model operation, Free/Plus/Pro context limits, tier prompts, expired membership fallback via existing `getEffectiveMembershipTier`, and verification.
- Placeholder scan: No placeholders or TBD items.
- Type consistency: The plan uses existing `MembershipTierId`, `streamChatCompletion`, and `/api/chat` test patterns.
