import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/study/extract/route";
import { extractStudyText } from "@/lib/study/extractors";

let session: { accessKeyId: string; visitorId: string } | null = {
  accessKeyId: "access-1",
  visitorId: "visitor-1",
};
let materialInsertCall: unknown = null;
let chunkInsertCall: unknown = null;
let rejectChunkColumns = false;

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn(() => Promise.resolve(session)),
}));

vi.mock("@/lib/study/extractors", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/study/extractors")>();
  return {
    ...actual,
    extractStudyText: vi.fn().mockResolvedValue({
      fileName: "lesson.pdf",
      mimeType: "application/pdf",
      extractedText: "第一章 管理学基础。第二章 组织结构。第三章 控制过程。",
      summaryPreview: "第一章 管理学基础。第二章 组织结构。",
      textLength: 30,
    }),
  };
});

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from(table: string) {
      if (table === "study_materials") {
        return {
          insert: vi.fn((row: unknown) => {
            materialInsertCall = row;
            if (rejectChunkColumns && typeof row === "object" && row !== null && "summary_cache" in row) {
              return {
                select: vi.fn(() => ({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: "PGRST204", message: "Could not find the 'summary_cache' column" },
                  }),
                })),
              };
            }
            return {
              select: vi.fn(() => ({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: "material-1",
                    file_name: "lesson.pdf",
                    mime_type: "application/pdf",
                    summary_preview: "第一章 管理学基础。第二章 组织结构。",
                    text_length: 30,
                    chunk_count: 1,
                  },
                  error: null,
                }),
              })),
            };
          }),
        };
      }

      if (table === "study_material_chunks") {
        return {
          insert: vi.fn((rows: unknown) => {
            chunkInsertCall = rows;
            return Promise.resolve({ error: null });
          }),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  })),
}));

function uploadRequest(file?: File) {
  const formData = new FormData();

  if (file) {
    formData.set("file", file);
  }

  return {
    formData: async () => formData,
  } as Request;
}

describe("study extract route", () => {
  beforeEach(() => {
    session = { accessKeyId: "access-1", visitorId: "visitor-1" };
    materialInsertCall = null;
    chunkInsertCall = null;
    rejectChunkColumns = false;
    vi.mocked(extractStudyText).mockClear();
  });

  it("returns 401 when the user is not logged in", async () => {
    session = null;

    const response = await POST(uploadRequest(new File(["fake"], "lesson.pdf", { type: "application/pdf" })));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "请先登录后再上传课件。" });
    expect(extractStudyText).not.toHaveBeenCalled();
  });

  it("returns 400 when no file is provided", async () => {
    const response = await POST(uploadRequest());

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "请选择一个课件文件。" });
    expect(extractStudyText).not.toHaveBeenCalled();
  });

  it("rejects unsupported files before extraction", async () => {
    const response = await POST(uploadRequest(new File(["fake"], "archive.zip", { type: "application/zip" })));

    expect(response.status).toBe(415);
    await expect(response.json()).resolves.toEqual({ error: "暂时只支持 PDF、PPTX、DOCX 和常见图片。" });
    expect(extractStudyText).not.toHaveBeenCalled();
  });

  it("rejects oversized files before extraction", async () => {
    const response = await POST(
      uploadRequest(new File([new Uint8Array(4 * 1024 * 1024 + 1)], "big.pdf", { type: "application/pdf" })),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "文件太大了，请压缩到 4MB 以内再上传。" });
    expect(extractStudyText).not.toHaveBeenCalled();
  });

  it("stores extracted text with ownership and returns only safe metadata", async () => {
    const response = await POST(uploadRequest(new File(["fake"], "lesson.pdf", { type: "application/pdf" })));

    expect(response.status).toBe(200);
    expect(extractStudyText).toHaveBeenCalled();
    expect(materialInsertCall).toMatchObject({
      access_key_id: "access-1",
      visitor_id: "visitor-1",
      file_name: "lesson.pdf",
      mime_type: "application/pdf",
      extracted_text: "第一章 管理学基础。第二章 组织结构。第三章 控制过程。",
      summary_preview: "第一章 管理学基础。第二章 组织结构。",
      summary_cache: expect.stringContaining("lesson.pdf"),
      text_length: 30,
      chunk_count: 1,
    });
    expect(chunkInsertCall).toMatchObject([
      {
        study_material_id: "material-1",
        access_key_id: "access-1",
        visitor_id: "visitor-1",
        chunk_index: 0,
        content: "第一章 管理学基础。第二章 组织结构。第三章 控制过程。",
        char_count: 28,
      },
    ]);
    await expect(response.json()).resolves.toEqual({
      material: {
        id: "material-1",
        fileName: "lesson.pdf",
        mimeType: "application/pdf",
        summaryPreview: "第一章 管理学基础。第二章 组织结构。",
        textLength: 30,
        chunkCount: 1,
      },
    });
  });

  it("falls back to legacy material storage before the chunk migration is applied", async () => {
    rejectChunkColumns = true;

    const response = await POST(uploadRequest(new File(["fake"], "lesson.pdf", { type: "application/pdf" })));

    expect(response.status).toBe(200);
    expect(materialInsertCall).toMatchObject({
      access_key_id: "access-1",
      visitor_id: "visitor-1",
      file_name: "lesson.pdf",
      mime_type: "application/pdf",
      extracted_text: "第一章 管理学基础。第二章 组织结构。第三章 控制过程。",
      summary_preview: "第一章 管理学基础。第二章 组织结构。",
    });
    expect(materialInsertCall).not.toHaveProperty("summary_cache");
    expect(materialInsertCall).not.toHaveProperty("chunk_count");
    expect(chunkInsertCall).toBeNull();
  });
});
