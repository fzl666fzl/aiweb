import { NextResponse } from "next/server";
import { AUTH_COOKIE, VISITOR_COOKIE, hashAccessCode, signAccessToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getOrCreateVisitorId } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!code) {
    return NextResponse.json({ error: "请输入访问密码。" }, { status: 400 });
  }

  const secret = getEnv("APP_ACCESS_SECRET");
  const keyHash = hashAccessCode(code, secret);
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("access_keys")
    .select("id")
    .eq("key_hash", keyHash)
    .eq("enabled", true)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Access key lookup failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "登录配置异常，请检查服务端配置。" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "访问密码不正确。" }, { status: 401 });
  }

  const visitorId = await getOrCreateVisitorId();
  const token = await signAccessToken({ accessKeyId: data.id }, secret);
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
