import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

type Context = {
  params: Promise<{ id: string }>;
};

export async function DELETE(_: Request, context: Context) {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "请先输入访问密码。" }, { status: 401 });
  }

  const { id } = await context.params;
  const supabase = createSupabaseAdmin();
  const { error, count } = await supabase
    .from("conversations")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("access_key_id", session.accessKeyId)
    .eq("visitor_id", session.visitorId);

  if (error) {
    return NextResponse.json({ error: "删除会话失败。" }, { status: 500 });
  }

  if (!count) {
    return NextResponse.json({ error: "会话不存在。" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
