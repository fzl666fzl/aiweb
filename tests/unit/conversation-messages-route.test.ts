import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/conversations/[id]/messages/route";

const conversationEqCalls: Array<[string, string]> = [];
const messageEqCalls: Array<[string, string]> = [];
const materialEqCalls: Array<[string, string]> = [];

vi.mock("@/lib/session", () => ({
  requireSession: vi.fn().mockResolvedValue({ accessKeyId: "access-1", visitorId: "visitor-1" }),
}));

vi.mock("@/lib/supabase", () => ({
  createSupabaseAdmin: vi.fn(() => ({
    from(table: string) {
      if (table === "conversations") {
        const builder = {
          eq(column: string, value: string) {
            conversationEqCalls.push([column, value]);
            return builder;
          },
          single: vi.fn().mockResolvedValue({ data: { id: "conversation-1" }, error: null }),
        };

        return {
          select: vi.fn(() => builder),
        };
      }

      if (table === "messages") {
        const builder = {
          eq(column: string, value: string) {
            messageEqCalls.push([column, value]);
            return builder;
          },
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "message-1",
                role: "user",
                content: "summarize",
                created_at: "2026-05-24T00:00:00.000Z",
              },
            ],
            error: null,
          }),
        };

        return {
          select: vi.fn(() => builder),
        };
      }

      if (table === "study_materials") {
        const builder = {
          eq(column: string, value: string) {
            materialEqCalls.push([column, value]);
            return builder;
          },
          order: vi.fn().mockResolvedValue({
            data: [
              {
                id: "material-1",
                file_name: "lesson.pdf",
                mime_type: "application/pdf",
                summary_preview: "lesson summary",
                text_length: 120,
                chunk_count: 3,
              },
            ],
            error: null,
          }),
        };

        return {
          select: vi.fn(() => builder),
        };
      }

      throw new Error(`Unexpected table: ${table}`);
    },
  })),
}));

describe("conversation messages route", () => {
  beforeEach(() => {
    conversationEqCalls.length = 0;
    messageEqCalls.length = 0;
    materialEqCalls.length = 0;
  });

  it("returns messages and study materials for the owned conversation", async () => {
    const response = await GET(new Request("http://localhost/api/conversations/conversation-1/messages"), {
      params: Promise.resolve({ id: "conversation-1" }),
    });

    expect(response.status).toBe(200);
    expect(conversationEqCalls).toEqual([
      ["id", "conversation-1"],
      ["access_key_id", "access-1"],
      ["visitor_id", "visitor-1"],
    ]);
    expect(messageEqCalls).toEqual([["conversation_id", "conversation-1"]]);
    expect(materialEqCalls).toEqual([
      ["conversation_id", "conversation-1"],
      ["access_key_id", "access-1"],
      ["visitor_id", "visitor-1"],
    ]);
    await expect(response.json()).resolves.toEqual({
      messages: [
        {
          id: "message-1",
          role: "user",
          content: "summarize",
          created_at: "2026-05-24T00:00:00.000Z",
        },
      ],
      studyMaterials: [
        {
          id: "material-1",
          fileName: "lesson.pdf",
          mimeType: "application/pdf",
          summaryPreview: "lesson summary",
          textLength: 120,
          chunkCount: 3,
        },
      ],
    });
  });
});
