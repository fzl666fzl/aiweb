import { describe, expect, it } from "vitest";
import {
  buildStudyChunkContext,
  buildStudySummaryCache,
  createStudyChunks,
  selectRelevantStudyChunks,
} from "@/lib/study/chunking";

describe("study chunking", () => {
  it("splits long courseware into ordered overlapping chunks", () => {
    const text = ["第一章 管理基础", "第二章 组织结构", "第三章 控制过程", "第四章 现场总线"].join("\n\n");

    const chunks = createStudyChunks(text, { chunkSize: 18, overlap: 4 });

    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((chunk) => chunk.chunkIndex)).toEqual(chunks.map((_, index) => index));
    expect(chunks[0].content).toContain("第一章");
    expect(chunks.at(-1)?.content).toContain("现场总线");
    expect(chunks.every((chunk) => chunk.charCount === chunk.content.length)).toBe(true);
  });

  it("builds an extractive summary cache from the whole material", () => {
    const text = [
      "第一章 现场总线概述，介绍工业控制网络的基本概念。",
      "第二章 PROFIBUS 通信协议，强调主从通信、令牌传递和报文结构。",
      "第三章 工业以太网，说明交换机、实时性和网络拓扑。",
      "第四章 复习题，要求比较现场总线和工业以太网。",
    ].join("\n\n");

    const summary = buildStudySummaryCache("network.pptx", text);

    expect(summary).toContain("network.pptx");
    expect(summary).toContain("现场总线概述");
    expect(summary).toContain("PROFIBUS");
    expect(summary).toContain("工业以太网");
    expect(summary.length).toBeLessThanOrEqual(1200);
  });

  it("selects late relevant chunks instead of only the beginning", () => {
    const text = [
      "第一章 管理学基础。计划、组织、领导、控制。",
      "第二章 人力资源管理。招聘、培训、绩效。",
      "第三章 成本会计。固定成本、变动成本。",
      "第四章 现场总线。PROFIBUS、CAN、工业以太网、实时通信。",
    ].join("\n\n");
    const chunks = createStudyChunks(text, { chunkSize: 32, overlap: 4 });

    const selected = selectRelevantStudyChunks(chunks, "PROFIBUS 和工业以太网有什么区别？", { maxChunks: 2 });

    expect(selected.map((chunk) => chunk.content).join("\n")).toContain("PROFIBUS");
    expect(selected.map((chunk) => chunk.content).join("\n")).not.toContain("人力资源管理");
  });

  it("uses representative chunks for whole-courseware summary requests", () => {
    const chunks = createStudyChunks(
      Array.from({ length: 10 }, (_, index) => `第${index + 1}章 内容 ${"知识点".repeat(16)}`).join("\n\n"),
      { chunkSize: 40, overlap: 0 },
    );

    const selected = selectRelevantStudyChunks(chunks, "请总结整份课件的核心考点", { maxChunks: 5 });

    expect(selected[0].chunkIndex).toBe(0);
    expect(selected.at(-1)?.chunkIndex).toBe(chunks.at(-1)?.chunkIndex);
    expect(new Set(selected.map((chunk) => chunk.chunkIndex)).size).toBe(selected.length);
  });

  it("builds compact context from summaries and selected chunks", () => {
    const context = buildStudyChunkContext([
      {
        fileName: "lesson.pptx",
        summaryCache: "课件摘要：现场总线、PROFIBUS、工业以太网。",
        chunks: createStudyChunks("第一章 无关内容。\n\n第二章 PROFIBUS 和工业以太网是考试重点。", {
          chunkSize: 28,
          overlap: 0,
        }),
      },
    ], "工业以太网考什么？", { maxChars: 500 });

    expect(context).toContain("课件摘要");
    expect(context).toContain("相关原文片段");
    expect(context).toContain("PROFIBUS");
    expect(context).toContain("工业以太网");
    expect(context.length).toBeLessThanOrEqual(500);
  });
});
