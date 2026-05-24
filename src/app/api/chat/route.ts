import { NextResponse } from "next/server";
import { streamChatCompletion } from "@/lib/ai";
import { getEnv } from "@/lib/env";
import { validateUserMessage } from "@/lib/limits";
import { getSystemPrompt } from "@/lib/persona-prompts";
import { getDefaultPersonaId, isAppId, isPersonaForApp, parsePersonaId, type AppId, type PersonaId } from "@/lib/personas";
import { requireSession } from "@/lib/session";
import { buildStudyChunkContext, type StudyChunk } from "@/lib/study/chunking";
import { createSupabaseAdmin } from "@/lib/supabase";

const CONTEXT_MESSAGE_LIMIT = 12;
const STUDY_CONTEXT_LIMIT = 8000;
const STUDY_CONTEXT_MESSAGE_LIMIT = 4;
const STUDY_STREAM_TIMEOUT_MS = 180000;
const AI_TIMEOUT_MESSAGE = "AI 服务响应超时，请稍后重试。";
const STUDY_TIMEOUT_MESSAGE =
  "课件内容比较多，AI 处理超时了。可以先让它“用 8 条总结核心考点”，或稍后重试。";

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

type StudyMaterialContext = {
  id?: string;
  fileName: string;
  extractedText: string;
  summaryCache: string;
  chunks: StudyChunk[];
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
    const studyMaterials = await resolveStudyMaterials(body, conversation, session, supabase);
    const studyContextMessage = buildStudyContextMessage(studyMaterials, validation.value);
    const historyLimit = conversation.appId === "study" ? STUDY_CONTEXT_MESSAGE_LIMIT : CONTEXT_MESSAGE_LIMIT;
    const { data: history } = await supabase
      .from("messages")
      .select("role, content")
      .eq("conversation_id", conversation.id)
      .order("created_at", { ascending: false })
      .limit(historyLimit);

    const messages = [
      { role: "system" as const, content: getSystemPrompt(conversation.personaId) },
      ...(studyContextMessage ? [studyContextMessage] : []),
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
            ...(conversation.appId === "study" ? { timeoutMs: STUDY_STREAM_TIMEOUT_MS } : {}),
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
          const message = error instanceof Error ? error.message : "发送失败。";
          const friendlyMessage =
            conversation.appId === "study" && message === AI_TIMEOUT_MESSAGE ? STUDY_TIMEOUT_MESSAGE : message;
          send("error", { message: friendlyMessage });
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
    const status = message === "会话不存在。" || message === "课件不存在或已失效。" ? 404 : 500;
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

async function resolveStudyMaterials(
  body: Record<string, unknown>,
  conversation: ConversationContext,
  session: Session,
  supabase: SupabaseAdmin,
): Promise<StudyMaterialContext[]> {
  if (conversation.appId !== "study") {
    return [];
  }

  const materialId = typeof body.studyMaterialId === "string" ? body.studyMaterialId : null;

  if (materialId) {
    const { data } = await supabase
      .from("study_materials")
      .select("id, conversation_id")
      .eq("id", materialId)
      .eq("access_key_id", session.accessKeyId)
      .eq("visitor_id", session.visitorId)
      .single();

    if (!data) {
      throw new Error("课件不存在或已失效。");
    }

    if (!data.conversation_id) {
      await supabase.from("study_materials").update({ conversation_id: conversation.id }).eq("id", materialId);
    } else if (data.conversation_id !== conversation.id) {
      throw new Error("课件不存在或已失效。");
    }
  }

  const { data: materials, error: materialsError } = await supabase
    .from("study_materials")
    .select("id, file_name, extracted_text, summary_preview, summary_cache, chunk_count")
    .eq("access_key_id", session.accessKeyId)
    .eq("visitor_id", session.visitorId)
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  if (materialsError && isMissingStudyChunkSchemaError(materialsError)) {
    return resolveLegacyStudyMaterials(conversation, session, supabase);
  }

  const contexts: StudyMaterialContext[] = [];

  for (const item of materials ?? []) {
    const materialId = typeof item.id === "string" ? item.id : undefined;
    let chunks: StudyChunk[] = [];

    if (materialId && typeof item.chunk_count === "number" && item.chunk_count > 0) {
      const { data: chunkRows } = await supabase
        .from("study_material_chunks")
        .select("chunk_index, content, char_count")
        .eq("study_material_id", materialId)
        .eq("access_key_id", session.accessKeyId)
        .eq("visitor_id", session.visitorId)
        .order("chunk_index", { ascending: true });

      chunks = (chunkRows ?? []).map((chunk) => ({
        chunkIndex: chunk.chunk_index,
        content: chunk.content,
        charCount: chunk.char_count,
      }));
    }

    contexts.push({
      id: materialId,
      fileName: item.file_name,
      extractedText: item.extracted_text,
      summaryCache: typeof item.summary_cache === "string" && item.summary_cache ? item.summary_cache : item.summary_preview ?? "",
      chunks,
    });
  }

  return contexts;
}

async function resolveLegacyStudyMaterials(
  conversation: ConversationContext,
  session: Session,
  supabase: SupabaseAdmin,
): Promise<StudyMaterialContext[]> {
  const { data: materials } = await supabase
    .from("study_materials")
    .select("file_name, extracted_text")
    .eq("access_key_id", session.accessKeyId)
    .eq("visitor_id", session.visitorId)
    .eq("conversation_id", conversation.id)
    .order("created_at", { ascending: true });

  return (materials ?? []).map((item) => ({
    fileName: item.file_name,
    extractedText: item.extracted_text,
    summaryCache: "",
    chunks: [],
  }));
}

function buildStudyContextMessage(materials: StudyMaterialContext[], query: string) {
  if (materials.length === 0) {
    return null;
  }

  const hasChunks = materials.some((material) => material.chunks.length > 0);
  const content = hasChunks
    ? buildStudyChunkContext(
        materials.map((material) => ({
          fileName: material.fileName,
          summaryCache: material.summaryCache,
          chunks: material.chunks,
          fallbackText: material.extractedText,
        })),
        query,
        { maxChars: STUDY_CONTEXT_LIMIT, maxChunks: 5 },
      )
    : materials
        .map((material, index) => `课件 ${index + 1}：${material.fileName}\n${material.extractedText}`)
        .join("\n\n---\n\n")
        .slice(0, STUDY_CONTEXT_LIMIT);

  return {
    role: "system" as const,
    content: `以下是用户上传课件中提取出的文字。回答复习问题时优先依据这些内容；如果内容不足，请明确说明。课件内容较长时，先按用户问题提取最相关内容，不要逐页复述。\n\n${content}`,
  };
}

function isMissingStudyChunkSchemaError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  return code === "PGRST204" || message.includes("summary_cache") || message.includes("chunk_count");
}
