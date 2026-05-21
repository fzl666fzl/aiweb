import { NextResponse } from "next/server";
import { callChatCompletion } from "@/lib/ai";
import { getEnv } from "@/lib/env";
import { validateUserMessage } from "@/lib/limits";
import { MAMANSHUO_SYSTEM_PROMPT } from "@/lib/persona";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

const CONTEXT_MESSAGE_LIMIT = 12;

type Session = {
  accessKeyId: string;
  visitorId: string;
};

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

export async function POST(request: Request) {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "访问尚未初始化，请刷新页面重试。" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const validation = validateUserMessage(body.message);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: validation.status });
  }

  const supabase = createSupabaseAdmin();

  try {
    const conversationId = await ensureConversation(body.conversationId, validation.value, session, supabase);
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(CONTEXT_MESSAGE_LIMIT);

    const messages = [
      { role: "system" as const, content: MAMANSHUO_SYSTEM_PROMPT },
      ...[...(history ?? [])]
        .reverse()
        .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
      { role: "user" as const, content: validation.value },
    ];
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
