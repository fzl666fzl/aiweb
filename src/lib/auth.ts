import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import type { AccessSession } from "./types";

export const AUTH_COOKIE = "aiweb_auth";
export const VISITOR_COOKIE = "aiweb_visitor";

export function createVisitorId() {
  return randomUUID();
}

export async function signAccessToken(session: AccessSession, secret: string) {
  const payload = Buffer.from(JSON.stringify(session), "utf8").toString("base64url");
  const signature = createHmac("sha256", secret).update(payload).digest("base64url");

  return `${payload}.${signature}`;
}

export async function verifyAccessToken(token: string | undefined, secret: string) {
  if (!token || !token.includes(".")) {
    return null;
  }

  const [payload, signature] = token.split(".");
  const expected = createHmac("sha256", secret).update(payload).digest("base64url");
  const actualSignature = Buffer.from(signature);
  const expectedSignature = Buffer.from(expected);

  if (
    actualSignature.length !== expectedSignature.length ||
    !timingSafeEqual(actualSignature, expectedSignature)
  ) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as AccessSession;
    return typeof parsed.accessKeyId === "string" ? parsed : null;
  } catch {
    return null;
  }
}
