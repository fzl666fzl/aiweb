import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Context) {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "请先输入访问密码。" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdmin();
  const { data: conversation } = await supabase
    .from("conversations")
    .select("id")
    .eq("id", id)
    .eq("access_key_id", session.accessKeyId)
    .eq("visitor_id", session.visitorId)
    .single();

  if (!conversation) {
    return NextResponse.json({ error: "会话不存在。" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("messages")
    .select("id, role, content, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: "读取消息失败。" }, { status: 500 });
  }

  return NextResponse.json({ messages: data });
}
