import { NextResponse } from "next/server";
import { AUTH_COOKIE, VISITOR_COOKIE, signAccessToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getOrCreateVisitorId } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function POST() {
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("access_keys")
    .select("id")
    .eq("enabled", true)
    .order("created_at", { ascending: true })
    .limit(1)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "未配置公开访问身份。" }, { status: 500 });
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
