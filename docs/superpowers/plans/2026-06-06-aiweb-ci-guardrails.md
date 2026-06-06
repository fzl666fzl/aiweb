# Aiweb CI Guardrails Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions CI workflow that runs the same merge-readiness checks used locally: dependency install, unit tests, lint, and production build.

**Architecture:** Create a single `.github/workflows/ci.yml` workflow for pull requests and pushes to active branches. Use Node.js 22, `npm ci`, npm cache, and the existing package scripts. Keep the workflow verification-only: no deployment, no SSH, no cloud credentials, and no repository secrets.

**Tech Stack:** GitHub Actions, Node.js 22, npm, Vitest, ESLint, Next.js build.

---

### Task 1: CI Workflow Contract

**Files:**
- Create: `tests/unit/ci-workflow.test.ts`
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ci-workflow.test.ts`:

```ts
// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readWorkflow() {
  return readFileSync(".github/workflows/ci.yml", "utf8");
}

describe("ci workflow", () => {
  it("runs merge-readiness checks on pushes and pull requests", () => {
    const workflow = readWorkflow();

    expect(workflow).toContain("name: CI");
    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("push:");
    expect(workflow).toContain("actions/checkout");
    expect(workflow).toContain("actions/setup-node");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("cache: npm");
    expect(workflow).toContain("npm ci");
    expect(workflow).toContain("npm test");
    expect(workflow).toContain("npm run lint");
    expect(workflow).toContain("npm run build");
  });

  it("stays verification-only and does not require deployment secrets", () => {
    const workflow = readWorkflow();

    expect(workflow).not.toContain("secrets.");
    expect(workflow).not.toContain("ssh");
    expect(workflow).not.toContain("docker compose up");
    expect(workflow).not.toContain("scp");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npm test -- tests/unit/ci-workflow.test.ts
```

Expected: FAIL because `.github/workflows/ci.yml` does not exist.

- [ ] **Step 3: Create the CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches:
      - main
      - "codex/**"

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 20

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Run unit tests
        run: npm test

      - name: Run lint
        run: npm run lint

      - name: Build
        run: npm run build
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```powershell
npm test -- tests/unit/ci-workflow.test.ts
```

Expected: PASS.

### Task 2: Full Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run focused tests**

Run:

```powershell
npm test -- tests/unit/ci-workflow.test.ts tests/unit/deployment-assets.test.ts
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

Expected: all commands exit 0.

- [ ] **Step 3: Summarize CI impact**

Report:
- CI trigger scope.
- Commands run by CI.
- Confirmation that the workflow does not deploy or consume secrets.
