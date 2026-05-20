import { expect, test } from "@playwright/test";

test("public chat UI initializes access automatically", async ({ page }) => {
  let authCalled = false;
  await page.route("**/api/auth", async (route) => {
    authCalled = true;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/conversations", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({ json: { conversations: [] } });
      return;
    }

    await route.fulfill({
      json: {
        conversation: {
          id: "c1",
          title: "新会话",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    });
  });

  await page.goto("/");

  await expect.poll(() => authCalled).toBe(true);
  await expect(page.getByText("今天想做点什么？")).toBeVisible();
  await expect(page.getByText("还没有对话")).toBeVisible();
  await page.getByRole("button", { name: "新建对话" }).click();
  await expect(page.locator("aside").getByText("新会话")).toBeVisible();
});
