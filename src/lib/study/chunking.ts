export type StudyChunk = {
  chunkIndex: number;
  content: string;
  charCount: number;
};

export type StudyMaterialForContext = {
  fileName: string;
  summaryCache: string;
  chunks: StudyChunk[];
  fallbackText?: string;
};

type ChunkOptions = {
  chunkSize?: number;
  overlap?: number;
};

type RetrievalOptions = {
  maxChunks?: number;
};

type ContextOptions = RetrievalOptions & {
  maxChars?: number;
};

const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 160;
const DEFAULT_MAX_CHUNKS = 5;
const DEFAULT_MAX_CONTEXT_CHARS = 12000;
const SUMMARY_MAX_CHARS = 1200;

const WHOLE_MATERIAL_TERMS = ["整份", "全部", "全文", "整体", "总览", "总结", "核心考点", "提纲"];
const STOP_WORDS = new Set([
  "一个",
  "什么",
  "怎么",
  "如何",
  "请帮我",
  "请",
  "帮我",
  "一下",
  "这份",
  "课件",
  "内容",
  "总结",
  "核心",
  "考点",
]);

export function createStudyChunks(text: string, options: ChunkOptions = {}): StudyChunk[] {
  const normalized = normalizeStudyText(text);

  if (!normalized) {
    return [];
  }

  const chunkSize = Math.max(1, options.chunkSize ?? DEFAULT_CHUNK_SIZE);
  const overlap = Math.max(0, Math.min(options.overlap ?? DEFAULT_CHUNK_OVERLAP, chunkSize - 1));
  const chunks: StudyChunk[] = [];
  let start = 0;

  while (start < normalized.length) {
    const end = Math.min(normalized.length, start + chunkSize);
    const content = normalized.slice(start, end).trim();

    if (content) {
      chunks.push({
        chunkIndex: chunks.length,
        content,
        charCount: content.length,
      });
    }

    if (end >= normalized.length) {
      break;
    }

    start = end - overlap;
  }

  return chunks;
}

export function buildStudySummaryCache(fileName: string, text: string) {
  const sentences = normalizeStudyText(text)
    .split(/(?<=[。！？!?])|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const selected = sentences.filter((line) => isLikelyHeading(line) || hasStudySignal(line)).slice(0, 10);
  const fallback = sentences.slice(0, 8);
  const lines = (selected.length > 0 ? selected : fallback).slice(0, 10);

  return [`文件：${fileName}`, "课件地图：", ...lines.map((line, index) => `${index + 1}. ${line}`)]
    .join("\n")
    .slice(0, SUMMARY_MAX_CHARS);
}

export function selectRelevantStudyChunks(
  chunks: StudyChunk[],
  query: string,
  options: RetrievalOptions = {},
): StudyChunk[] {
  const maxChunks = options.maxChunks ?? DEFAULT_MAX_CHUNKS;

  if (chunks.length === 0) {
    return [];
  }

  if (isWholeMaterialQuery(query)) {
    return chunks.length <= maxChunks ? chunks : selectRepresentativeChunks(chunks, maxChunks);
  }

  const terms = extractQueryTerms(query);

  if (terms.length === 0) {
    return chunks.length <= maxChunks ? chunks : selectRepresentativeChunks(chunks, maxChunks);
  }

  const scored = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk.content, terms) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.chunk.chunkIndex - b.chunk.chunkIndex)
    .slice(0, maxChunks)
    .map((item) => item.chunk)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);

  return scored.length > 0 ? scored : selectRepresentativeChunks(chunks, maxChunks);
}

export function buildStudyChunkContext(
  materials: StudyMaterialForContext[],
  query: string,
  options: ContextOptions = {},
) {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CONTEXT_CHARS;
  const parts: string[] = [
    "以下是用户上传课件的缓存摘要和按当前问题检索出的相关原文片段。回答时优先依据这些内容；如果证据不足，请明确说明。不要逐页复述，先回答用户当前问题。",
  ];

  for (const material of materials) {
    parts.push(`\n## ${material.fileName}`);

    if (material.summaryCache) {
      parts.push(`\n### 课件摘要\n${material.summaryCache}`);
    }

    const chunks = material.chunks.length > 0
      ? selectRelevantStudyChunks(material.chunks, query, options)
      : createStudyChunks(material.fallbackText ?? "", { chunkSize: 1600, overlap: 120 }).slice(0, options.maxChunks ?? DEFAULT_MAX_CHUNKS);

    if (chunks.length > 0) {
      parts.push("\n### 相关原文片段");
      for (const chunk of chunks) {
        parts.push(`[片段 ${chunk.chunkIndex + 1}]\n${chunk.content}`);
      }
    }
  }

  return parts.join("\n\n").slice(0, maxChars);
}

function normalizeStudyText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isLikelyHeading(line: string) {
  return /第[一二三四五六七八九十\d]+[章节讲]|^\d+(\.\d+)*\s*\S+/.test(line) && line.length <= 80;
}

function hasStudySignal(line: string) {
  return /重点|考点|定义|特点|区别|比较|分类|流程|步骤|原理|结构|协议|模型|方法/.test(line);
}

function isWholeMaterialQuery(query: string) {
  return WHOLE_MATERIAL_TERMS.some((term) => query.includes(term));
}

function extractQueryTerms(query: string) {
  const terms = new Set<string>();
  const normalized = query.toLowerCase();
  const asciiTerms = normalized.match(/[a-z0-9][a-z0-9+#.-]{1,}/g) ?? [];

  for (const term of asciiTerms) {
    terms.add(term);
  }

  const chineseTerms = query.match(/[\u4e00-\u9fa5]{2,}/g) ?? [];
  for (const term of chineseTerms) {
    if (!STOP_WORDS.has(term)) {
      terms.add(term);
    }

    for (let index = 0; index <= term.length - 2; index += 1) {
      const pair = term.slice(index, index + 2);
      if (!STOP_WORDS.has(pair)) {
        terms.add(pair);
      }
    }
  }

  return [...terms].filter((term) => term.length >= 2);
}

function scoreChunk(content: string, terms: string[]) {
  const lowerContent = content.toLowerCase();
  let score = 0;

  for (const term of terms) {
    const normalizedTerm = term.toLowerCase();
    if (lowerContent.includes(normalizedTerm)) {
      score += normalizedTerm.length >= 4 ? 3 : 1;
    }
  }

  return score;
}

function selectRepresentativeChunks(chunks: StudyChunk[], maxChunks: number) {
  if (chunks.length <= maxChunks) {
    return chunks;
  }

  if (maxChunks <= 1) {
    return [chunks[0]];
  }

  const indexes = new Set<number>();
  const lastIndex = chunks.length - 1;

  for (let slot = 0; slot < maxChunks; slot += 1) {
    indexes.add(Math.round((slot * lastIndex) / (maxChunks - 1)));
  }

  return [...indexes]
    .sort((a, b) => a - b)
    .map((index) => chunks[index])
    .filter((chunk): chunk is StudyChunk => Boolean(chunk));
}
