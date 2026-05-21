import { describe, expect, it } from "vitest";
import { hashPassword, isQqEmail, normalizeEmail, verifyPassword } from "@/lib/account-auth";

describe("account auth helpers", () => {
  it("only accepts qq.com email addresses", () => {
    expect(normalizeEmail("  123456@qq.com ")).toBe("123456@qq.com");
    expect(isQqEmail("name@qq.com")).toBe(true);
    expect(isQqEmail("name@gmail.com")).toBe(false);
    expect(isQqEmail("name@qq.com.cn")).toBe(false);
  });

  it("hashes and verifies passwords", () => {
    const password = "safe-password-123";
    const result = hashPassword(password);

    expect(result.passwordHash).not.toBe(password);
    expect(result.passwordSalt.length).toBeGreaterThan(0);
    expect(verifyPassword(password, result.passwordSalt, result.passwordHash)).toBe(true);
    expect(verifyPassword("wrong-password", result.passwordSalt, result.passwordHash)).toBe(false);
  });
});
