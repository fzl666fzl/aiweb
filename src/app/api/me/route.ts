import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "请先登录或注册账号。" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select("email")
    .eq("access_key_id", session.accessKeyId)
    .eq("enabled", true)
    .limit(1)
    .single();

  if (error || !data || typeof data.email !== "string") {
    return NextResponse.json({ error: "请先登录或注册账号。" }, { status: 401 });
  }

  return NextResponse.json({ user: { email: data.email } });
}
