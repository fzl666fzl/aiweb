import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { extractStudyText, validateStudyFile } from "@/lib/study/extractors";

vi.mock("@/lib/ai", () => ({
  callVisionTextExtraction: vi.fn().mockResolvedValue("图片里的课堂重点文字，适合整理成复习提纲。"),
}));

vi.mock("@/lib/env", () => ({
  getEnv: vi.fn((name: string) => {
    const values: Record<string, string> = {
      AI_BASE_URL: "https://example.test/v1",
      AI_API_KEY: "test-key",
      AI_MODEL: "test-model",
    };
    return values[name] ?? "test";
  }),
}));

function fileFromBuffer(name: string, type: string, buffer: Buffer) {
  return new File([buffer], name, { type });
}

async function createPptxFixture() {
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
      <Default Extension="xml" ContentType="application/xml"/>
    </Types>`,
  );
  zip.file(
    "ppt/slides/slide1.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
    <p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
      xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
      <p:cSld>
        <p:spTree>
          <p:sp><p:txBody><a:p><a:r><a:t>管理学第一章</a:t></a:r></a:p></p:txBody></p:sp>
          <p:sp><p:txBody><a:p><a:r><a:t>计划、组织、领导、控制是管理职能的考试重点</a:t></a:r></a:p></p:txBody></p:sp>
        </p:spTree>
      </p:cSld>
    </p:sld>`,
  );
  return Buffer.from(await zip.generateAsync({ type: "uint8array" }));
}

describe("validateStudyFile", () => {
  it("accepts supported courseware files within the size limit", () => {
    expect(validateStudyFile({ name: "lesson.pdf", type: "application/pdf", size: 1024 }).ok).toBe(true);
    expect(
      validateStudyFile({
        name: "slides.pptx",
        type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        size: 1024,
      }).ok,
    ).toBe(true);
    expect(
      validateStudyFile({
        name: "notes.docx",
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        size: 1024,
      }).ok,
    ).toBe(true);
    expect(validateStudyFile({ name: "photo.png", type: "image/png", size: 1024 }).ok).toBe(true);
    expect(validateStudyFile({ name: "photo.jpg", type: "image/jpeg", size: 1024 }).ok).toBe(true);
    expect(validateStudyFile({ name: "photo.webp", type: "image/webp", size: 1024 }).ok).toBe(true);
  });

  it("rejects old Office binary formats with a conversion hint", () => {
    expect(validateStudyFile({ name: "lesson.ppt", type: "application/vnd.ms-powerpoint", size: 1024 })).toEqual({
      ok: false,
      status: 415,
      message: "暂时不能直接读取老版 Office 文件，请另存为 PPTX、DOCX 或 PDF 后上传。",
    });
  });

  it("rejects unsupported files", () => {
    expect(validateStudyFile({ name: "archive.zip", type: "application/zip", size: 1024 })).toEqual({
      ok: false,
      status: 415,
      message: "暂时只支持 PDF、PPTX、DOCX 和常见图片。",
    });
  });

  it("rejects oversized files", () => {
    expect(validateStudyFile({ name: "big.pdf", type: "application/pdf", size: 4 * 1024 * 1024 + 1 })).toEqual({
      ok: false,
      status: 413,
      message: "文件太大了，请压缩到 4MB 以内再上传。",
    });
  });
});

describe("extractStudyText", () => {
  it("extracts text from pptx slides", async () => {
    const file = fileFromBuffer(
      "slides.pptx",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      await createPptxFixture(),
    );

    const result = await extractStudyText(file);

    expect(result).toMatchObject({
      fileName: "slides.pptx",
      mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    });
    expect(result.extractedText).toContain("管理学第一章");
    expect(result.extractedText).toContain("计划、组织、领导、控制是管理职能的考试重点");
    expect(result.summaryPreview.length).toBeGreaterThan(0);
    expect(result.textLength).toBe(result.extractedText.length);
  });

  it("extracts text from images through the vision helper", async () => {
    const file = fileFromBuffer("photo.png", "image/png", Buffer.from("fake-image"));

    const result = await extractStudyText(file);

    expect(result.extractedText).toContain("图片里的课堂重点文字");
  });

  it("throws a friendly error when extracted text is empty", async () => {
    await expect(extractStudyText(fileFromBuffer("empty.pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation", Buffer.from("")))).rejects.toThrow(
      "没有读取到可用文字，请换一个文件或把课件导出为带文字的 PDF。",
    );
  });
});
