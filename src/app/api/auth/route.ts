import { NextResponse } from "next/server";
import { AUTH_COOKIE, VISITOR_COOKIE, hashAccessCode, signAccessToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getOrCreateVisitorId } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));

  if (typeof body.code !== "string" || body.code.trim().length === 0) {
    return NextResponse.json({ error: "请输入访问密码。" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const hash = hashAccessCode(body.code, getEnv("APP_ACCESS_SECRET"));
  const { data, error } = await supabase
    .from("access_keys")
    .select("id, enabled")
    .eq("key_hash", hash)
    .eq("enabled", true)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "访问密码不正确。" }, { status: 401 });
  }

  const visitorId = await getOrCreateVisitorId();
  const token = await signAccessToken({ accessKeyId: data.id }, getEnv("APP_ACCESS_SECRET"));
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
  });
  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
  });

  return response;
}
