import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatApp } from "@/components/ChatApp";
import { apiJson } from "@/lib/client-api";

vi.mock("@/lib/client-api", () => ({
  apiJson: vi.fn(),
}));

describe("ChatApp", () => {
  beforeEach(() => {
    vi.mocked(apiJson).mockReset();
  });

  it("announces chat errors with an alert", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ conversations: [] });
    apiMock.mockRejectedValueOnce(new Error("AI 服务暂时不可用，请稍后重试。"));

    render(<ChatApp />);

    await userEvent.type(await screen.findByRole("textbox", { name: "消息输入" }), "hello");
    await userEvent.keyboard("{Enter}");

    expect(await screen.findByRole("alert")).toHaveTextContent("AI 服务暂时不可用，请稍后重试。");
  });

  it("asks for an access code before loading conversations", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockRejectedValueOnce(new Error("访问尚未初始化，请先输入访问密码。"));
    apiMock.mockResolvedValueOnce({ ok: true });
    apiMock.mockResolvedValueOnce({ conversations: [] });

    render(<ChatApp />);

    await screen.findByRole("heading", { name: "欢迎回来，慢慢说" });
    await userEvent.type(screen.getByLabelText("访问密码"), "fzl666fzl");
    await userEvent.click(screen.getByRole("button", { name: "进入小站" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(3));
    expect(apiMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ code: "fzl666fzl" }) }),
    );
    expect(apiMock).toHaveBeenNthCalledWith(3, "/api/conversations");
  });
});
