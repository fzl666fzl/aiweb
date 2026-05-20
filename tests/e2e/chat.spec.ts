import { expect, test } from "@playwright/test";

test("password gate allows entry to chat UI", async ({ page }) => {
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
  await expect(page.getByLabel("访问密码")).toBeVisible();
  await page.getByLabel("访问密码").fill("pass123");
  await page.getByRole("button", { name: "进入" }).click();
  await expect.poll(() => authCalled).toBe(true);
  await expect(page.getByText("暂无历史会话")).toBeVisible();
  await page.getByRole("button", { name: "新会话" }).click();
  await expect(page.locator("aside").getByText("新会话").nth(1)).toBeVisible();
});
