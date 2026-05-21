import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const PASSWORD_KEY_LENGTH = 64;
const MIN_PASSWORD_LENGTH = 8;
const MAX_PASSWORD_LENGTH = 128;

export function normalizeEmail(email: string) {
  const value = email.trim().toLowerCase();
  return isQqEmail(value) ? value : null;
}

export function isQqEmail(email: string) {
  return /^[^\s@]+@qq\.com$/i.test(email.trim());
}

export function validatePassword(password: string) {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return "密码至少需要 8 位。";
  }

  if (password.length > MAX_PASSWORD_LENGTH) {
    return "密码不能超过 128 位。";
  }

  return null;
}

export function hashPassword(password: string) {
  const passwordSalt = randomBytes(16).toString("hex");
  const passwordHash = scryptSync(password, passwordSalt, PASSWORD_KEY_LENGTH).toString("hex");

  return { passwordHash, passwordSalt };
}

export function verifyPassword(password: string, passwordSalt: string, passwordHash: string) {
  const expected = Buffer.from(passwordHash, "hex");

  if (expected.length !== PASSWORD_KEY_LENGTH) {
    return false;
  }

  const actual = scryptSync(password, passwordSalt, PASSWORD_KEY_LENGTH);
  return timingSafeEqual(actual, expected);
}
