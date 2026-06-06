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

  it("uses MEMBERSHIP_CODE_SECRET from the environment by default", () => {
    const output = execFileSync(
      "node",
      ["scripts/generate-membership-codes.mjs", "plus", "1"],
      {
        encoding: "utf8",
        env: {
          ...process.env,
          APP_ACCESS_SECRET: "wrong-secret",
          MEMBERSHIP_CODE_SECRET: "membership-secret",
        },
      },
    );

    const code = output.match(/AIWEB-PLUS-[A-Z0-9-]+/)?.[0];
    const hash = output.match(/[a-f0-9]{64}/)?.[0];

    expect(code).toBeTruthy();
    expect(hash).toBeTruthy();
    expect(hash).not.toBe(
      execFileSync(
        "node",
        [
          "-e",
          `console.log(require("node:crypto").createHmac("sha256", "wrong-secret").update(${JSON.stringify(code)}.trim(), "utf8").digest("hex"))`,
        ],
        { encoding: "utf8" },
      ).trim(),
    );
    expect(hash).toBe(
      execFileSync(
        "node",
        [
          "-e",
          `console.log(require("node:crypto").createHmac("sha256", "membership-secret").update(${JSON.stringify(code)}.trim(), "utf8").digest("hex"))`,
        ],
        { encoding: "utf8" },
      ).trim(),
    );
  });
});
