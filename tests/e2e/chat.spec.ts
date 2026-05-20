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

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "输入访问密码" })).toBeVisible();
  await page.getByLabel("访问密码").fill("fzl666fzl");
  await page.getByRole("button", { name: "进入网站" }).click();

  await expect.poll(() => authCode).toBe("fzl666fzl");
  await expect(page.getByText("今天想做点什么？")).toBeVisible();
  await expect(page.getByText("还没有对话")).toBeVisible();
  await page.getByRole("button", { name: "新建对话" }).click();
  await expect(page.locator("aside").getByText("新会话")).toBeVisible();
});
