import { render, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ChatApp } from "@/components/ChatApp";
import { apiJson } from "@/lib/client-api";

vi.mock("@/lib/client-api", () => ({
  apiJson: vi.fn(),
}));

describe("ChatApp", () => {
  it("initializes public access before loading conversations", async () => {
    const apiMock = vi.mocked(apiJson);
    apiMock.mockResolvedValueOnce({ ok: true });
    apiMock.mockResolvedValueOnce({ conversations: [] });

    render(<ChatApp />);

    await waitFor(() => expect(apiMock).toHaveBeenCalledTimes(2));
    expect(apiMock).toHaveBeenNthCalledWith(
      1,
      "/api/auth",
      expect.objectContaining({ method: "POST", body: JSON.stringify({}) }),
    );
    expect(apiMock).toHaveBeenNthCalledWith(2, "/api/conversations");
  });
});
