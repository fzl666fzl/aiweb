import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { StudyApp } from "@/components/StudyApp";
import { apiJson } from "@/lib/client-api";

vi.mock("@/lib/client-api", () => ({
  apiJson: vi.fn(),
}));

describe("StudyApp", () => {
  beforeEach(() => {
    vi.mocked(apiJson).mockReset();
    vi.unstubAllGlobals();
  });

  it("uploads multiple courseware files, shows them together, and sends all material ids", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockImplementation((input, init) => {
      if (input === "/api/study/extract") {
        const file = (init?.body as FormData).get("file") as File;

        return Promise.resolve({
          material: {
            id: file.name === "lesson-1.pdf" ? "material-1" : "material-2",
            fileName: file.name,
            mimeType: file.type,
            summaryPreview: `${file.name} summary`,
            textLength: 30,
            chunkCount: 1,
          },
        });
      }

      return Promise.resolve({ conversations: [] });
    });
    const encoder = new TextEncoder();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('event: conversation\ndata: {"conversationId":"c1"}\n\n'));
            controller.enqueue(encoder.encode('event: delta\ndata: {"content":"ok"}\n\n'));
            controller.enqueue(encoder.encode("event: done\ndata: {}\n\n"));
            controller.close();
          },
        }),
        { headers: { "Content-Type": "text/event-stream" } },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<StudyApp />);

    const fileInput = (await screen.findByLabelText("选择课件文件")) as HTMLInputElement;
    await userEvent.upload(fileInput, [
      new File(["fake 1"], "lesson-1.pdf", { type: "application/pdf" }),
      new File(["fake 2"], "lesson-2.pdf", { type: "application/pdf" }),
    ]);

    expect(await screen.findByText("lesson-1.pdf")).toBeInTheDocument();
    expect(await screen.findByText("lesson-2.pdf")).toBeInTheDocument();

    await userEvent.type(screen.getByRole("textbox"), "summarize both");
    await userEvent.keyboard("{Enter}");

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/chat",
        expect.objectContaining({
          body: JSON.stringify({
            appId: "study",
            conversationId: null,
            message: "summarize both",
            personaId: "study-helper",
            studyMaterialIds: ["material-1", "material-2"],
          }),
        }),
      ),
    );

    await userEvent.click(screen.getByRole("button", { name: /lesson-1\.pdf/ }));
    expect(screen.queryByText("lesson-1.pdf")).not.toBeInTheDocument();
    expect(screen.getByText("lesson-2.pdf")).toBeInTheDocument();
  });

  it("restores study materials when users open a history conversation", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockImplementation((input) => {
      if (input === "/api/conversations?appId=study") {
        return Promise.resolve({
          conversations: [
            {
              id: "conversation-1",
              title: "exam review",
              app_id: "study",
              persona_id: "study-helper",
              created_at: "2026-05-24T00:00:00.000Z",
              updated_at: "2026-05-24T00:00:00.000Z",
            },
          ],
        });
      }

      if (input === "/api/conversations/conversation-1/messages") {
        return Promise.resolve({
          messages: [],
          studyMaterials: [
            {
              id: "material-1",
              fileName: "saved-lesson.pdf",
              mimeType: "application/pdf",
              summaryPreview: "saved lesson summary",
              textLength: 88,
              chunkCount: 2,
            },
          ],
        });
      }

      return Promise.resolve({ conversations: [] });
    });

    render(<StudyApp />);

    await userEvent.click(await screen.findByRole("button", { name: "exam review" }));

    expect(await screen.findByText("saved-lesson.pdf")).toBeInTheDocument();
    expect(screen.getByText("saved lesson summary")).toBeInTheDocument();
  });

  it("uploads courseware, shows safe metadata, and lets users remove it", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockImplementation((input) => {
      if (input === "/api/study/extract") {
        return Promise.resolve({
          material: {
            id: "material-1",
            fileName: "lesson.pdf",
            mimeType: "application/pdf",
            summaryPreview: "第一章 管理学基础。第二章 组织结构。",
            textLength: 30,
          },
        });
      }

      return Promise.resolve({ conversations: [] });
    });

    render(<StudyApp />);

    expect(await screen.findByText("上传课件开始复习")).toBeInTheDocument();
    await userEvent.upload(
      screen.getByLabelText("选择课件文件"),
      new File(["fake"], "lesson.pdf", { type: "application/pdf" }),
    );

    expect(await screen.findByText("lesson.pdf")).toBeInTheDocument();
    expect(screen.getByText("第一章 管理学基础。第二章 组织结构。")).toBeInTheDocument();
    expect(apiMock).toHaveBeenCalledWith(
      "/api/study/extract",
      expect.objectContaining({ method: "POST", body: expect.any(FormData) }),
    );

    await userEvent.click(screen.getByRole("button", { name: "移除 lesson.pdf" }));

    expect(screen.getByText("上传课件开始复习")).toBeInTheDocument();
    expect(screen.queryByText("lesson.pdf")).not.toBeInTheDocument();
  });

  it("uses a study-specific empty state instead of companion prompt cards", async () => {
    vi.mocked(apiJson).mockResolvedValueOnce({ conversations: [] });

    render(<StudyApp />);

    expect(await screen.findByRole("heading", { name: "先上传一份课件" })).toBeInTheDocument();
    expect(screen.getByText("支持 PDF、PPTX、DOCX 和图片。读取后可以让复习助手总结重点、提炼考点或生成自测题。")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "我有点累" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "总结课件" })).toBeInTheDocument();
  });

  it("shows an alert when upload fails", async () => {
    vi.mocked(apiJson).mockImplementation((input) => {
      if (input === "/api/study/extract") {
        return Promise.reject(new Error("暂时只支持 PDF、PPTX、DOCX 和常见图片。"));
      }

      return Promise.resolve({ conversations: [] });
    });

    render(<StudyApp />);

    await screen.findByText("上传课件开始复习");
    await userEvent.upload(
      screen.getByLabelText("选择课件文件"),
      new File(["fake"], "lesson.pdf", { type: "application/pdf" }),
    );

    await waitFor(() =>
      expect(screen.getByRole("alert")).toHaveTextContent("暂时只支持 PDF、PPTX、DOCX 和常见图片。"),
    );
  });
});
