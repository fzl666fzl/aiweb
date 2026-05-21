import { expect, test } from "@playwright/test";

test("chat UI unlocks with a shared access code", async ({ page }) => {
  let authCalled = false;
  let authCode = "";

  await page.route("**/api/auth", async (route) => {
    authCalled = true;
    authCode = (await route.request().postDataJSON()).code;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/conversations", async (route) => {
    if (route.request().method() === "GET") {
      if (!authCalled) {
        await route.fulfill({ status: 401, json: { error: "请先输入访问密码。" } });
        return;
      }

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

  await page.goto("/apps/mamanshuo");

  await expect(page.getByRole("heading", { name: "欢迎回来，慢慢说" })).toBeVisible();
  await page.getByLabel("访问密码").fill("fzl666fzl");
  await page.getByRole("button", { name: "进入小站" }).click();

  await expect.poll(() => authCode).toBe("fzl666fzl");
  await expect(page.getByText("今天想先说点什么？")).toBeVisible();
  await expect(page.getByText("还没有对话")).toBeVisible();
  await page.getByRole("button", { name: "新建对话" }).click();
  await expect(page.locator("aside").getByText("新会话")).toBeVisible();
});

test("home page shows the app hub and links to 慢慢说", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "fzl AI 小站" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "把一些小小的 AI 工具，放在这里。" })).toBeVisible();
  await expect(page.getByRole("link", { name: /进入慢慢说/ })).toHaveAttribute("href", "/apps/mamanshuo");
  await expect(page.getByRole("heading", { name: "学习整理" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "写作润色" })).toBeVisible();
});
