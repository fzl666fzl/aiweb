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

    await userEvent.click(screen.getByRole("button", { name: "移除" }));

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
