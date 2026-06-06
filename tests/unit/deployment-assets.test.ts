// @vitest-environment node

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function readText(path: string) {
  return readFileSync(path, "utf8");
}

describe("deployment assets", () => {
  it("builds a standalone Next.js runtime image", () => {
    const dockerfile = readText("Dockerfile");
    const nextConfig = readText("next.config.ts");

    expect(nextConfig).toContain('output: "standalone"');
    expect(dockerfile).toContain("FROM node:22-bookworm-slim AS runner");
    expect(dockerfile).toContain("npm run build");
    expect(dockerfile).toContain("ARG NEXT_PUBLIC_LDXP_PLUS_URL");
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
    expect(dockerfile).toContain("USER nextjs");
  });

  it("sets conservative production security headers without adding CSP yet", () => {
    const nextConfig = readText("next.config.ts");

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
  });

  it("keeps the aiweb container behind Caddy instead of publishing a host port", () => {
    const compose = readText("deployment/docker-compose.aiweb.yml");

    expect(compose).toContain("container_name: aiweb");
    expect(compose).toContain("env_file:");
    expect(compose).toContain("/opt/aiweb/.env.production");
    expect(compose).toContain("expose:");
    expect(compose).toContain('"3000"');
    expect(compose).toContain("mem_limit: 2g");
    expect(compose).toContain("max-size: 10m");
    expect(compose).not.toMatch(/^\s*ports:/m);
  });

  it("configures a container healthcheck against the runtime health route", () => {
    const compose = readText("deployment/docker-compose.aiweb.yml");

    expect(compose).toContain("healthcheck:");
    expect(compose).toContain("http://127.0.0.1:3000/api/health");
    expect(compose).toContain("start_period: 30s");
  });

  it("attaches to the existing external Caddy network", () => {
    const compose = readText("deployment/docker-compose.aiweb.yml");
    const composeEnv = readText("deployment/compose.env.example");

    expect(compose).toContain("external: true");
    expect(compose).toContain("name: ${AIWEB_CADDY_NETWORK}");
    expect(composeEnv).toContain("AIWEB_CADDY_NETWORK=");
    expect(composeEnv).toContain("NEXT_PUBLIC_LDXP_PLUS_URL=");
    expect(composeEnv).toContain("docker inspect caddy");
  });

  it("supports a systemd Caddy host by publishing aiweb only on localhost", () => {
    const compose = readText("deployment/docker-compose.aiweb.systemd-caddy.yml");

    expect(compose).toContain("container_name: aiweb");
    expect(compose).toContain("/opt/aiweb/.env.production");
    expect(compose).toContain("127.0.0.1:3000:3000");
    expect(compose).not.toContain("80:3000");
    expect(compose).not.toContain("443:3000");
    expect(compose).toContain("networks: {}");
  });

  it("adds only frontend Caddy routes and leaves api.fzl-ai.top alone", () => {
    const caddyfile = readText("deployment/Caddyfile.aiweb.example");

    expect(caddyfile).toContain("fzl-ai.top, www.fzl-ai.top");
    expect(caddyfile).toContain("reverse_proxy aiweb:3000");
    expect(caddyfile).not.toMatch(/^\s*api\.fzl-ai\.top\s*\{/m);
  });

  it("documents the Tencent Lighthouse smoke-test and rollback path", () => {
    const runbook = readText("docs/deployment/tencent-lighthouse-aiweb.md");

    expect(runbook).toContain("43.133.240.199");
    expect(runbook).toContain("docker compose --env-file /opt/aiweb/compose.env");
    expect(runbook).toContain("docker exec aiweb node -e");
    expect(runbook).toContain("https://fzl-ai.top/api/health");
    expect(runbook).toContain("Strict-Transport-Security");
    expect(runbook).toContain("X-Content-Type-Options");
    expect(runbook).toContain("Content-Security-Policy is intentionally not set");
    expect(runbook).toContain("https://api.fzl-ai.top/admin/dashboard");
    expect(runbook).toContain("Do not change the `api.fzl-ai.top` Caddy block");
    expect(runbook).toContain("systemd Caddy");
    expect(runbook).toContain("127.0.0.1:3000");
    expect(runbook).toContain("Rollback");
  });

  it("provides a server preflight script for the deployment runbook", () => {
    const script = readText("deployment/preflight-aiweb.sh");

    expect(script).toContain("AIWEB_CADDY_NETWORK");
    expect(script).toContain("docker network inspect");
    expect(script).toContain("docker compose --env-file");
    expect(script).toContain("ports:");
    expect(script).toContain("/opt/aiweb/.env.production");
    expect(script).toContain("required_env_vars");
    expect(script).toContain("AI_BASE_URL");
    expect(script).toContain("AI_MODEL");
    expect(script).toContain("SUPABASE_URL");
    expect(script).toContain("https://fzl-ai.top/api/health");
  });
});
