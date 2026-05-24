import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";
import { buildStudySummaryCache, createStudyChunks } from "@/lib/study/chunking";
import { extractStudyText, validateStudyFile } from "@/lib/study/extractors";

type InsertedStudyMaterial = {
  id: string;
  file_name: string;
  mime_type: string;
  summary_preview: string;
  text_length: number;
  chunk_count?: number;
};

export async function POST(request: Request) {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "请先登录后再上传课件。" }, { status: 401 });
  }

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");

  if (!isUploadedFile(file)) {
    return NextResponse.json({ error: "请选择一个课件文件。" }, { status: 400 });
  }

  const validation = validateStudyFile(file);

  if (!validation.ok) {
    return NextResponse.json({ error: validation.message }, { status: validation.status });
  }

  try {
    const extracted = await extractStudyText(file);
    const chunks = createStudyChunks(extracted.extractedText);
    const summaryCache = buildStudySummaryCache(extracted.fileName, extracted.extractedText);
    const supabase = createSupabaseAdmin();
    let chunksEnabled = true;
    const materialResult = await supabase
      .from("study_materials")
      .insert(buildMaterialRow(extracted, session, { chunkCount: chunks.length, summaryCache }))
      .select("id, file_name, mime_type, summary_preview, text_length, chunk_count")
      .single();
    let data = materialResult.data as InsertedStudyMaterial | null;
    let error = materialResult.error;

    if (error && isMissingChunkSchemaError(error)) {
      chunksEnabled = false;
      const legacyResult = await supabase
        .from("study_materials")
        .insert(buildMaterialRow(extracted, session))
        .select("id, file_name, mime_type, summary_preview, text_length")
        .single();
      data = legacyResult.data as InsertedStudyMaterial | null;
      error = legacyResult.error;
    }

    if (error || !data) {
      throw new Error("保存课件文字失败，请稍后重试。");
    }

    const material = data as InsertedStudyMaterial;
    const chunkRows = chunks.map((chunk) => ({
      study_material_id: material.id,
      access_key_id: session.accessKeyId,
      visitor_id: session.visitorId,
      chunk_index: chunk.chunkIndex,
      content: chunk.content,
      char_count: chunk.charCount,
    }));

    if (chunksEnabled && chunkRows.length > 0) {
      const { error: chunkError } = await supabase.from("study_material_chunks").insert(chunkRows);

      if (chunkError) {
        throw new Error("保存课件分块失败，请稍后重试。");
      }
    }

    return NextResponse.json({
      material: {
        id: material.id,
        fileName: material.file_name,
        mimeType: material.mime_type,
        summaryPreview: material.summary_preview,
        textLength: material.text_length,
        chunkCount: material.chunk_count ?? 0,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "课件读取失败，请稍后重试。" },
      { status: 500 },
    );
  }
}

function buildMaterialRow(
  extracted: Awaited<ReturnType<typeof extractStudyText>>,
  session: { accessKeyId: string; visitorId: string },
  chunkMetadata?: { chunkCount: number; summaryCache: string },
) {
  return {
    access_key_id: session.accessKeyId,
    visitor_id: session.visitorId,
    file_name: extracted.fileName,
    mime_type: extracted.mimeType,
    extracted_text: extracted.extractedText,
    summary_preview: extracted.summaryPreview,
    ...(chunkMetadata ? { summary_cache: chunkMetadata.summaryCache, chunk_count: chunkMetadata.chunkCount } : {}),
    text_length: extracted.textLength,
  };
}

function isMissingChunkSchemaError(error: unknown) {
  if (typeof error !== "object" || error === null) {
    return false;
  }

  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const code = "code" in error && typeof error.code === "string" ? error.code : "";

  return code === "PGRST204" || message.includes("summary_cache") || message.includes("chunk_count");
}

function isUploadedFile(value: FormDataEntryValue | null | undefined): value is File {
  return (
    typeof value === "object" &&
    value !== null &&
    "name" in value &&
    "type" in value &&
    "size" in value &&
    "arrayBuffer" in value &&
    typeof value.name === "string" &&
    typeof value.type === "string" &&
    typeof value.size === "number" &&
    typeof value.arrayBuffer === "function"
  );
}
