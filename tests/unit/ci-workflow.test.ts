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
