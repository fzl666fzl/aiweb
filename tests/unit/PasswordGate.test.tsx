import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { PasswordGate } from "@/components/PasswordGate";

describe("PasswordGate", () => {
  it("submits the entered access password", async () => {
    const onAuthed = vi.fn();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<PasswordGate onAuthed={onAuthed} />);

    await userEvent.type(screen.getByLabelText("访问密码"), "pass123");
    await userEvent.click(screen.getByRole("button", { name: "进入" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/auth",
      expect.objectContaining({
        body: JSON.stringify({ code: "pass123" }),
        method: "POST",
      }),
    );
    expect(onAuthed).toHaveBeenCalled();
  });
});
