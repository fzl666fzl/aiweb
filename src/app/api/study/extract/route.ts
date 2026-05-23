import { NextResponse } from "next/server";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";
import { extractStudyText, validateStudyFile } from "@/lib/study/extractors";

type InsertedStudyMaterial = {
  id: string;
  file_name: string;
  mime_type: string;
  summary_preview: string;
  text_length: number;
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
    const supabase = createSupabaseAdmin();
    const { data, error } = await supabase
      .from("study_materials")
      .insert({
        access_key_id: session.accessKeyId,
        visitor_id: session.visitorId,
        file_name: extracted.fileName,
        mime_type: extracted.mimeType,
        extracted_text: extracted.extractedText,
        summary_preview: extracted.summaryPreview,
        text_length: extracted.textLength,
      })
      .select("id, file_name, mime_type, summary_preview, text_length")
      .single();

    if (error || !data) {
      throw new Error("保存课件文字失败，请稍后重试。");
    }

    const material = data as InsertedStudyMaterial;

    return NextResponse.json({
      material: {
        id: material.id,
        fileName: material.file_name,
        mimeType: material.mime_type,
        summaryPreview: material.summary_preview,
        textLength: material.text_length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "课件读取失败，请稍后重试。" },
      { status: 500 },
    );
  }
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
