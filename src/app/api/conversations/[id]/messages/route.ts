import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

type Context = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: Context) {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "访问尚未初始化，请刷新页面重试。" }, { status: 401 });
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

  const { data: studyMaterials, error: materialsError } = await supabase
    .from("study_materials")
    .select("id, file_name, mime_type, summary_preview, text_length, chunk_count")
    .eq("conversation_id", id)
    .eq("access_key_id", session.accessKeyId)
    .eq("visitor_id", session.visitorId)
    .order("created_at", { ascending: true });

  if (materialsError && !isMissingStudyMaterialSchemaError(materialsError)) {
    return NextResponse.json({ error: "读取课件失败。" }, { status: 500 });
  }

  return NextResponse.json({
    messages: data,
    studyMaterials: (studyMaterials ?? []).map((material) => ({
      id: material.id,
      fileName: material.file_name,
      mimeType: material.mime_type,
      summaryPreview: material.summary_preview,
      textLength: material.text_length,
      chunkCount: material.chunk_count ?? 0,
    })),
  });
}

function isMissingStudyMaterialSchemaError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return message.includes("study_materials") || message.includes("chunk_count");
}
