# Tencent Lighthouse Aiweb Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a repeatable self-hosted Docker deployment path for `aiweb` on the user's Tencent Cloud Lighthouse Ubuntu 22.04 server without disturbing the existing `api.fzl-ai.top` Sub2API/Caddy stack.

**Architecture:** Build the Next.js app as a standalone Node server inside a Debian-based Docker image, run it as an `aiweb` container on the same Docker network as the existing Caddy container, and add a separate Caddy site block for the front-end domain. Keep secrets in `/opt/aiweb/.env.production` on the server and keep generated card codes or screenshots out of Git.

**Tech Stack:** Next.js 16 App Router, Node.js 22 Docker image, Docker Compose v2, Caddy reverse proxy, Vitest deployment asset tests.

---

### Task 1: Enable Standalone Docker Build

**Files:**
- Modify: `next.config.ts`
- Create: `Dockerfile`
- Create: `.dockerignore`

- [ ] **Step 1: Update Next output mode**

Add `output: "standalone"` to `nextConfig` so `next build` creates `.next/standalone/server.js`.

- [ ] **Step 2: Add production Dockerfile**

Create a multi-stage Dockerfile using `node:22-bookworm-slim`, `npm ci`, `npm run build`, and a non-root runtime user. Copy `public`, `.next/standalone`, and `.next/static` into the final image.

- [ ] **Step 3: Add Docker build context ignore rules**

Ignore `node_modules`, `.next`, `.git`, local env files, generated membership codes, submission proof screenshots, Spec Kit tool directories, and local reports.

- [ ] **Step 4: Verify local standalone build**

Run: `npm run build`

Expected: exit code 0 and `.next/standalone/server.js` exists.

### Task 2: Add Compose And Caddy Deployment Assets

**Files:**
- Create: `deployment/docker-compose.aiweb.yml`
- Create: `deployment/compose.env.example`
- Create: `deployment/Caddyfile.aiweb.example`

- [ ] **Step 1: Add Compose file**

Define one `aiweb` service with `build.context: ..`, `dockerfile: Dockerfile`, `container_name: aiweb`, `restart: unless-stopped`, `env_file: /opt/aiweb/.env.production`, `expose: 3000`, and an external Caddy network named from `AIWEB_CADDY_NETWORK`.

- [ ] **Step 2: Add Compose env example**

Document `AIWEB_CADDY_NETWORK` as the Docker network already used by the existing Caddy container.

- [ ] **Step 3: Add Caddy site block example**

Add a Caddy example for `fzl-ai.top, www.fzl-ai.top` that reverse proxies to `aiweb:3000`, enables compression, and does not mention or override `api.fzl-ai.top`.

### Task 3: Add Operator Documentation

**Files:**
- Create: `docs/deployment/tencent-lighthouse-aiweb.md`
- Modify: `docs/PROJECT_GUIDE.md`

- [ ] **Step 1: Write server deployment runbook**

Document DNS records, server directory layout, secret file contents, network discovery commands, deploy commands, Caddy update commands, smoke tests, logs, rollback, and what not to touch.

- [ ] **Step 2: Link runbook from project guide**

Add a concise pointer in the deployment section so future agents discover the self-hosting path.

### Task 4: Add Deployment Asset Tests

**Files:**
- Create: `tests/unit/deployment-assets.test.ts`

- [ ] **Step 1: Write tests**

Assert that Dockerfile uses standalone runtime, Compose does not publish a host port, Compose uses an external Caddy network, and the Caddy example does not route `api.fzl-ai.top`.

- [ ] **Step 2: Run focused test**

Run: `npm test -- tests/unit/deployment-assets.test.ts`

Expected: pass.

### Task 5: Full Verification

**Files:**
- All changed files.

- [ ] **Step 1: Run full tests**

Run: `npm test`

Expected: all Vitest files pass.

- [ ] **Step 2: Run lint**

Run: `npm run lint`

Expected: ESLint exits 0.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: Next.js build exits 0 and `.next/standalone/server.js` exists.

- [ ] **Step 4: Inspect Git status**

Run: `git status --short --branch` and `git diff --stat`

Expected: deployment assets are isolated from existing membership feature changes; no generated codes, env files, screenshots, or tool caches are tracked.
