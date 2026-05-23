import { NextResponse } from "next/server";
import { streamChatCompletion } from "@/lib/ai";
import { getEnv } from "@/lib/env";
import { validateUserMessage } from "@/lib/limits";
import { getSystemPrompt } from "@/lib/persona-prompts";
import { getDefaultPersonaId, isAppId, isPersonaForApp, parsePersonaId, type AppId, type PersonaId } from "@/lib/personas";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

const CONTEXT_MESSAGE_LIMIT = 12;

type Session = {
  accessKeyId: string;
  visitorId: string;
};

type SupabaseAdmin = ReturnType<typeof createSupabaseAdmin>;

type ConversationContext = {
  id: string;
  appId: AppId;
  personaId: PersonaId;
};

async function enforceDailyLimit(session: Session, supabase: SupabaseAdmin) {
  const { data: accessKey, error: accessKeyError } = await supabase
    .from("access_keys")
    .select("daily_limit")
    .eq("id", session.accessKeyId)
    .eq("enabled", true)
    .single();

  if (accessKeyError || !accessKey || typeof accessKey.daily_limit !== "number") {
    return { ok: false as const, status: 401, message: "登录状态已过期，请重新登录后再试。" };
  }

  const usageDate = new Intl.DateTimeFormat("sv-SE", {
    day: "2-digit",
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).format(new Date());
  const { data, error } = await supabase.rpc("increment_usage_if_allowed", {
    p_access_key_id: session.accessKeyId,
    p_access_limit: accessKey.daily_limit,
    p_usage_date: usageDate,
    p_visitor_id: session.visitorId,
    p_visitor_limit: accessKey.daily_limit,
  });

  if (error) {
    return { ok: false as const, status: 500, message: "服务器或网络暂时不稳定，请稍后再试。" };
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.allowed) {
    return { ok: false as const, status: 429, message: "今天的提问次数已经用完了，请明天再来。" };
  }

  return { ok: true as const };
}

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

  const rawAppId = body.appId ?? "mamanshuo";
  const appId = isAppId(rawAppId) ? rawAppId : null;

  if (!appId) {
    return NextResponse.json({ error: "未知的应用。" }, { status: 400 });
  }

  const requestedPersonaId = parsePersonaId(body.personaId ?? getDefaultPersonaId(appId), appId);

  if (!requestedPersonaId) {
    return NextResponse.json({ error: "未知的人物。" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();

  try {
    const usage = await enforceDailyLimit(session, supabase);

    if (!usage.ok) {
      return NextResponse.json({ error: usage.message }, { status: usage.status });
    }

    const conversation = await ensureConversation(
      body.conversationId,
      validation.value,
      appId,
      requestedPersonaId,
      session,
      supabase,
    );
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(CONTEXT_MESSAGE_LIMIT);

    const messages = [
      { role: "system" as const, content: getSystemPrompt(conversation.personaId) },
      ...[...(history ?? [])]
        .reverse()
        .map((message) => ({ role: message.role as "user" | "assistant", content: message.content })),
      { role: "user" as const, content: validation.value },
    ];
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        let answer = "";

        function send(event: string, data: unknown) {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        }

        try {
          send("conversation", {
            conversationId: conversation.id,
            appId: conversation.appId,
            personaId: conversation.personaId,
          });

          for await (const chunk of streamChatCompletion(messages, {
            baseUrl: getEnv("AI_BASE_URL"),
            apiKey: getEnv("AI_API_KEY"),
            model: getEnv("AI_MODEL"),
          })) {
            answer += chunk;
            send("delta", { content: chunk });
          }

          if (!answer.trim()) {
            throw new Error("AI 服务返回为空，请稍后重试。");
          }

          const createdAt = new Date().toISOString();
          const { error: insertError } = await supabase.from("messages").insert([
            { conversation_id: conversation.id, role: "user", content: validation.value },
            { conversation_id: conversation.id, role: "assistant", content: answer },
          ]);

          if (insertError) {
            throw new Error("保存消息失败。");
          }

          await supabase.from("conversations").update({ updated_at: createdAt }).eq("id", conversation.id);
          send("done", { createdAt });
        } catch (error) {
          send("error", { message: error instanceof Error ? error.message : "发送失败。" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Cache-Control": "no-cache, no-transform",
        "Content-Type": "text/event-stream; charset=utf-8",
      },
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
  appId: AppId,
  personaId: PersonaId,
  session: Session,
  supabase: SupabaseAdmin,
): Promise<ConversationContext> {
  if (typeof conversationId === "string" && conversationId.length > 0) {
    const { data } = await supabase
      .from("conversations")
      .select("id, app_id, persona_id")
      .eq("id", conversationId)
      .eq("access_key_id", session.accessKeyId)
      .eq("visitor_id", session.visitorId)
      .eq("app_id", appId)
      .single();

    if (!data) {
      throw new Error("会话不存在。");
    }

    if (!isAppId(data.app_id) || !isPersonaForApp(data.persona_id, data.app_id)) {
      throw new Error("会话不存在。");
    }

    return { id: data.id, appId: data.app_id, personaId: data.persona_id };
  }

  const title = message.slice(0, 30);
  const { data, error } = await supabase
    .from("conversations")
    .insert({
      access_key_id: session.accessKeyId,
      visitor_id: session.visitorId,
      app_id: appId,
      persona_id: personaId,
      title,
    })
    .select("id, app_id, persona_id")
    .single();

  if (error || !data) {
    throw new Error("创建会话失败。");
  }

  return { id: data.id, appId: data.app_id as AppId, personaId: data.persona_id as PersonaId };
}
