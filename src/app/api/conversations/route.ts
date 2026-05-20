import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "访问尚未初始化，请刷新页面重试。" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("conversations")
    .select("id, title, created_at, updated_at")
    .eq("access_key_id", session.accessKeyId)
    .eq("visitor_id", session.visitorId)
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: "读取会话失败。" }, { status: 500 });
  }

  return NextResponse.json({ conversations: data });
}

export async function POST(request: Request) {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "访问尚未初始化，请刷新页面重试。" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const title =
    typeof body.title === "string" && body.title.trim().length > 0
      ? body.title.trim().slice(0, 80)
      : "新会话";
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("conversations")
    .insert({ access_key_id: session.accessKeyId, visitor_id: session.visitorId, title })
    .select("id, title, created_at, updated_at")
    .single();

  if (error) {
    return NextResponse.json({ error: "创建会话失败。" }, { status: 500 });
  }

  return NextResponse.json({ conversation: data });
}
