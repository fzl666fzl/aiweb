import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { hashAccessCode, signAccessToken, verifyAccessToken } from "@/lib/auth";

describe("auth helpers", () => {
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

  it("hashes access codes with the app secret", () => {
    expect(hashAccessCode(" fzl666fzl ", "secret")).toBe(
      createHmac("sha256", "secret").update("fzl666fzl", "utf8").digest("hex"),
    );
  });
});
