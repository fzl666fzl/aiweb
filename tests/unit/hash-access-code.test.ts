import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

function hashAccessCode(code: string, secret: string) {
  return createHmac("sha256", secret).update(code.trim(), "utf8").digest("hex");
}

describe("access-code hashing", () => {
  it("creates deterministic HMAC-SHA256 hashes without returning plaintext", () => {
    const hash = hashAccessCode(" shared-pass ", "secret");

    expect(hash).toBe(hashAccessCode("shared-pass", "secret"));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toContain("shared-pass");
  });
});
