import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("generate membership codes script", () => {
  it("prints redeem codes and matching SQL inserts", () => {
    const output = execFileSync(
      "node",
      ["scripts/generate-membership-codes.mjs", "plus", "2", "--secret", "test-secret"],
      { encoding: "utf8" },
    );

    const codes = output.match(/AIWEB-PLUS-[A-Z0-9-]+/g) ?? [];
    const hashes = output.match(/[a-f0-9]{64}/g) ?? [];

    expect(codes).toHaveLength(2);
    expect(new Set(codes).size).toBe(2);
    expect(hashes).toHaveLength(2);
    expect(output).toContain("insert into membership_codes");
    expect(output).toContain("'plus', 31");
  });
});
