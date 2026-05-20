import { describe, expect, it } from "vitest";
import { hashAccessCode, signAccessToken, verifyAccessToken } from "@/lib/auth";

describe("auth helpers", () => {
  it("hashes access codes deterministically", () => {
    expect(hashAccessCode(" pass ", "secret")).toBe(hashAccessCode("pass", "secret"));
    expect(hashAccessCode("pass", "secret")).toMatch(/^[a-f0-9]{64}$/);
  });

  it("verifies signed access tokens", async () => {
    const token = await signAccessToken({ accessKeyId: "key-1" }, "secret");

    await expect(verifyAccessToken(token, "secret")).resolves.toEqual({
      accessKeyId: "key-1",
    });
  });

  it("rejects tampered access tokens", async () => {
    const token = await signAccessToken({ accessKeyId: "key-1" }, "secret");

    await expect(verifyAccessToken(`${token}x`, "secret")).resolves.toBeNull();
  });
});
