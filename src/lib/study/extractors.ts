import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { callVisionTextExtraction } from "@/lib/ai";
import { getEnv } from "@/lib/env";
import type { StudyExtractResult } from "./types";

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const MIN_EXTRACTED_CHARS = 20;
const MAX_EXTRACTED_CHARS = 60000;

const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const IMAGE_MIME_TYPES = ["image/png", "image/jpeg", "image/webp"];

type FileLike = Pick<File, "name" | "type" | "size">;

export function validateStudyFile(file: FileLike) {
  const name = file.name.toLowerCase();

  if (file.size > MAX_UPLOAD_BYTES) {
    return { ok: false as const, status: 413, message: "文件太大了，请压缩到 4MB 以内再上传。" };
  }

  if (name.endsWith(".ppt") || name.endsWith(".doc")) {
    return {
      ok: false as const,
      status: 415,
      message: "暂时不能直接读取老版 Office 文件，请另存为 PPTX、DOCX 或 PDF 后上传。",
    };
  }

  if (isPdf(file) || isPptx(file) || isDocx(file) || isImage(file)) {
    return { ok: true as const };
  }

  return { ok: false as const, status: 415, message: "暂时只支持 PDF、PPTX、DOCX 和常见图片。" };
}

export async function extractStudyText(file: File): Promise<StudyExtractResult> {
  const validation = validateStudyFile(file);

  if (!validation.ok) {
    throw new Error(validation.message);
  }

  let extractedText = "";
  const buffer = Buffer.from(await file.arrayBuffer());

  try {
    if (isPdf(file)) {
      extractedText = await extractPdfText(buffer);
    } else if (isDocx(file)) {
      const parsed = await mammoth.extractRawText({ buffer });
      extractedText = parsed.value;
    } else if (isPptx(file)) {
      extractedText = await extractPptxText(buffer);
    } else if (isImage(file)) {
      extractedText = await callVisionTextExtraction(
        {
          dataUrl: `data:${file.type};base64,${buffer.toString("base64")}`,
          fileName: file.name,
        },
        {
          baseUrl: getEnv("AI_BASE_URL"),
          apiKey: getEnv("AI_API_KEY"),
          model: process.env.AI_VISION_MODEL || getEnv("AI_MODEL"),
        },
      );
    }
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("AI 服务")) {
      throw error;
    }

    throw new Error("没有读取到可用文字，请换一个文件或把课件导出为带文字的 PDF。");
  }

  const normalized = normalizeExtractedText(extractedText);

  if (normalized.length < MIN_EXTRACTED_CHARS) {
    throw new Error("没有读取到可用文字，请换一个文件或把课件导出为带文字的 PDF。");
  }

  const clipped = normalized.slice(0, MAX_EXTRACTED_CHARS);

  return {
    fileName: file.name,
    mimeType: file.type || inferMimeType(file.name),
    extractedText: clipped,
    summaryPreview: clipped.slice(0, 180),
    textLength: clipped.length,
  };
}

async function extractPdfText(buffer: Buffer) {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });

  try {
    const result = await parser.getText();
    return result.text;
  } finally {
    await parser.destroy();
  }
}

async function extractPptxText(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const parser = new XMLParser({ ignoreAttributes: false, textNodeName: "#text" });
  const slideFiles = Object.keys(zip.files)
    .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const parts: string[] = [];

  for (const slideName of slideFiles) {
    const file = zip.files[slideName];

    if (!file) {
      continue;
    }

    const xml = await file.async("string");
    const parsed = parser.parse(xml);
    const texts: string[] = [];
    collectTextNodes(parsed, texts);

    if (texts.length > 0) {
      parts.push(texts.join(" "));
    }
  }

  return parts.join("\n\n");
}

function collectTextNodes(value: unknown, texts: string[]) {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) {
      texts.push(trimmed);
    }
    return;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      collectTextNodes(item, texts);
    }
    return;
  }

  if (typeof value === "object" && value !== null) {
    for (const [key, child] of Object.entries(value)) {
      if (key === "a:t" || key === "#text") {
        collectTextNodes(child, texts);
      } else if (typeof child === "object" && child !== null) {
        collectTextNodes(child, texts);
      }
    }
  }
}

function normalizeExtractedText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPdf(file: FileLike) {
  return file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
}

function isPptx(file: FileLike) {
  return file.type === PPTX_MIME || file.name.toLowerCase().endsWith(".pptx");
}

function isDocx(file: FileLike) {
  return file.type === DOCX_MIME || file.name.toLowerCase().endsWith(".docx");
}

function isImage(file: FileLike) {
  return IMAGE_MIME_TYPES.includes(file.type);
}

function inferMimeType(fileName: string) {
  const name = fileName.toLowerCase();

  if (name.endsWith(".pdf")) {
    return "application/pdf";
  }

  if (name.endsWith(".pptx")) {
    return PPTX_MIME;
  }

  if (name.endsWith(".docx")) {
    return DOCX_MIME;
  }

  return "application/octet-stream";
}
