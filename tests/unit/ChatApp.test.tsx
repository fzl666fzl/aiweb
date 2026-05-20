import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChatApp } from "@/components/ChatApp";
import { apiJson } from "@/lib/client-api";

vi.mock("@/lib/client-api", () => ({
  apiJson: vi.fn(),
}));

describe("ChatApp", () => {
  it("asks for an access code before loading conversations", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockRejectedValueOnce(new Error("访问尚未初始化，请先输入访问密码。"));
    apiMock.mockResolvedValueOnce({ ok: true });
    apiMock.mockResolvedValueOnce({ conversations: [] });

    render(<ChatApp />);

    await screen.findByRole("heading", { name: "输入访问密码" });
    await userEvent.type(screen.getByLabelText("访问密码"), "fzl666fzl");
    await userEvent.click(screen.getByRole("button", { name: "进入网站" }));

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(3));
    expect(apiMock).toHaveBeenNthCalledWith(
      2,
      "/api/auth",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ code: "fzl666fzl" }) }),
    );
    expect(apiMock).toHaveBeenNthCalledWith(3, "/api/conversations");
  });
});
