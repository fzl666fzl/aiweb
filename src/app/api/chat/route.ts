import { NextResponse } from "next/server";
import { callChatCompletion } from "@/lib/ai";
import { getEnv } from "@/lib/env";
import { validateUserMessage } from "@/lib/limits";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

const VISITOR_DAILY_LIMIT = 30;
const CONTEXT_MESSAGE_LIMIT = 12;

type Session = {
  accessKeyId: string;
  visitorId: string;
};

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export async function POST(request: Request) {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "请先输入访问密码。" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const validation = validateUserMessage(body.message);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: validation.status });
  }

  const supabase = createSupabaseAdmin();
  const { data: accessKey } = await supabase
    .from("access_keys")
    .select("daily_limit, enabled")
    .eq("id", session.accessKeyId)
    .eq("enabled", true)
    .single();

  if (!accessKey) {
    return NextResponse.json({ error: "访问密码已失效。" }, { status: 401 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: limitResult, error: limitError } = await supabase.rpc("increment_usage_if_allowed", {
    p_access_key_id: session.accessKeyId,
    p_visitor_id: session.visitorId,
    p_usage_date: today,
    p_access_limit: accessKey.daily_limit,
    p_visitor_limit: VISITOR_DAILY_LIMIT,
  });
  const limitRows = Array.isArray(limitResult) ? limitResult : [limitResult];
  const allowed = limitRows[0]?.allowed;

  if (limitError || !allowed) {
    return NextResponse.json({ error: "今日请求次数已用完，请明天再试。" }, { status: 429 });
  }

  try {
    const conversationId = await ensureConversation(body.conversationId, validation.value, session, supabase);
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(CONTEXT_MESSAGE_LIMIT);

    const messages = [...(history ?? [])]
      .reverse()
      .map((message) => ({ role: message.role as "user" | "assistant", content: message.content }))
      .concat({ role: "user", content: validation.value });
    const answer = await callChatCompletion(messages, {
      baseUrl: getEnv("AI_BASE_URL"),
      apiKey: getEnv("AI_API_KEY"),
      model: getEnv("AI_MODEL"),
    });

    const { error: insertError } = await supabase.from("messages").insert([
      { conversation_id: conversationId, role: "user", content: validation.value },
      { conversation_id: conversationId, role: "assistant", content: answer },
    ]);

    if (insertError) {
      return NextResponse.json({ error: "保存消息失败。" }, { status: 500 });
    }

    await supabase.from("conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);

    return NextResponse.json({
      conversationId,
      assistantMessage: { role: "assistant", content: answer, createdAt: new Date().toISOString() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "发送失败。";
    const status = message === "会话不存在。" ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

async function ensureConversation(
  conversationId: unknown,
  message: string,
  session: Session,
  supabase: SupabaseAdmin,
) {
  if (typeof conversationId === "string" && conversationId.length > 0) {
    const { data } = await supabase
      .from("conversations")
      .select("id")
      .eq("id", conversationId)
      .eq("access_key_id", session.accessKeyId)
      .eq("visitor_id", session.visitorId)
      .single();

    if (!data) {
      throw new Error("会话不存在。");
    }

    return data.id;
  }

  const title = message.slice(0, 30);
  const { data, error } = await supabase
    .from("conversations")
    .insert({ access_key_id: session.accessKeyId, visitor_id: session.visitorId, title })
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("创建会话失败。");
  }

  return data.id;
}
