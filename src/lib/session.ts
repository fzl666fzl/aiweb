import { cookies } from "next/headers";
import { AUTH_COOKIE, VISITOR_COOKIE, createVisitorId, verifyAccessToken } from "./auth";
import { getEnv } from "./env";

export async function requireSession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  const visitorId = cookieStore.get(VISITOR_COOKIE)?.value;
  const session = await verifyAccessToken(token, getEnv("APP_ACCESS_SECRET"));

  if (!session || !visitorId) {
    return null;
  }

  return { accessKeyId: session.accessKeyId, visitorId };
}

export async function getOrCreateVisitorId() {
  const cookieStore = await cookies();
  return cookieStore.get(VISITOR_COOKIE)?.value ?? createVisitorId();
}
