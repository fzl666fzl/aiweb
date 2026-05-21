import { expect, test } from "@playwright/test";

test("chat UI unlocks with a qq email account", async ({ page }) => {
  let authCalled = false;
  let authBody: Record<string, string> = {};

  await page.route("**/api/auth", async (route) => {
    authCalled = true;
    authBody = await route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/conversations**", async (route) => {
    if (route.request().method() === "GET") {
      if (!authCalled) {
        await route.fulfill({ status: 401, json: { error: "请先登录或注册账号。" } });
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
  await page.getByRole("button", { name: "注册" }).click();
  await page.getByLabel("QQ 邮箱").fill("user@qq.com");
  await page.getByLabel("密码").fill("password123");
  await page.getByRole("button", { name: "注册账号" }).click();

  await expect.poll(() => authBody).toMatchObject({
    email: "user@qq.com",
    mode: "register",
    password: "password123",
  });
  await expect(page.getByText("今天想先说点什么？")).toBeVisible();
  await expect(page.getByText("还没有对话")).toBeVisible();
  await page.getByRole("button", { name: "新建对话" }).click();
  await expect(page.locator("aside").getByText("新会话")).toBeVisible();
});

test("mobile chat keeps history in a drawer", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.route("**/api/conversations**", async (route) => {
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

  await page.goto("/apps/mamanshuo");

  await expect(page.getByText("今天想先说点什么？")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "历史对话" })).toBeHidden();

  await page.getByRole("button", { name: "打开历史对话" }).click();
  await expect(page.getByRole("dialog", { name: "历史对话" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建对话" })).toBeVisible();

  await page.getByRole("button", { name: "关闭历史对话" }).click();
  await expect(page.getByRole("dialog", { name: "历史对话" })).toBeHidden();
});

test("chat page renders streamed assistant replies", async ({ page }) => {
  await page.route("**/api/conversations**", async (route) => {
    await route.fulfill({ json: { conversations: [] } });
  });
  await page.route("**/api/chat", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ message: "你好" });
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body:
        'event: conversation\ndata: {"conversationId":"c1"}\n\n' +
        'event: delta\ndata: {"content":"收到"}\n\n' +
        'event: delta\ndata: {"content":"啦"}\n\n' +
        "event: done\ndata: {}\n\n",
    });
  });

  await page.goto("/apps/mamanshuo");

  await page.getByRole("textbox", { name: "消息输入" }).fill("你好");
  await page.keyboard.press("Enter");

  await expect(page.getByText("收到啦")).toBeVisible();
});

test("home page shows the app hub and links to 慢慢说", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "fzl AI 小站" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "把一些小小的 AI 工具，放在这里。" })).toBeVisible();
  await expect(page.getByRole("link", { name: /进入慢慢说/ })).toHaveAttribute("href", "/apps/mamanshuo");
  await expect(page.getByRole("heading", { name: "和名人对话" })).toBeVisible();
  await expect(page.getByRole("link", { name: /进入名人对话/ })).toHaveAttribute("href", "/apps/celebrities");
  await expect(page.getByRole("heading", { name: "写作润色" })).toBeVisible();
});

test("celebrity chat sends the selected advisor persona", async ({ page }) => {
  await page.route("**/api/conversations**", async (route) => {
    await route.fulfill({ json: { conversations: [] } });
  });
  await page.route("**/api/chat", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      appId: "celebrities",
      message: "专业怎么选",
      personaId: "zhangxuefeng",
    });
    await route.fulfill({
      status: 200,
      contentType: "text/event-stream; charset=utf-8",
      body:
        'event: conversation\ndata: {"conversationId":"c2","appId":"celebrities","personaId":"zhangxuefeng"}\n\n' +
        'event: delta\ndata: {"content":"先看就业"}\n\n' +
        "event: done\ndata: {}\n\n",
    });
  });

  await page.goto("/apps/celebrities");

  await expect(page.getByRole("heading", { name: "和名人对话" })).toBeVisible();
  const sidebar = page.getByRole("complementary", { name: "人物和历史侧栏" });
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
  await expect(sidebar.getByRole("button", { name: "收起侧栏" })).toBeVisible();
  await expect(sidebar.getByRole("button", { name: /张一鸣/ })).toBeVisible();
  const initialSidebarWidth = await sidebar.evaluate((node) => node.getBoundingClientRect().width);
  const resizeHandle = page.getByRole("separator", { name: "调整侧栏宽度" });
  await expect(resizeHandle).toBeVisible();
  const handleBox = await resizeHandle.boundingBox();
  expect(handleBox).not.toBeNull();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + handleBox!.height / 2);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x + 72, handleBox!.y + handleBox!.height / 2);
  await page.mouse.up();
  const resizedSidebarWidth = await sidebar.evaluate((node) => node.getBoundingClientRect().width);
  expect(resizedSidebarWidth).toBeGreaterThan(initialSidebarWidth + 40);
  await expect(page.getByRole("region", { name: "选择名人顾问" })).toBeHidden();
  await expect(page.locator("html")).toHaveJSProperty("scrollLeft", 0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
  await sidebar.getByRole("button", { name: /张雪峰/ }).click();
  await page.getByRole("textbox", { name: "消息输入" }).fill("专业怎么选");
  await page.keyboard.press("Enter");

  await expect(page.getByText("先看就业")).toBeVisible();
});
