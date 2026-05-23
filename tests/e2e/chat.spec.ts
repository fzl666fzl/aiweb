import { expect, type Page, test } from "@playwright/test";

async function mockAccount(page: Page, initialAuth = true) {
  let authenticated = initialAuth;

  await page.route("**/api/me", async (route) => {
    if (!authenticated) {
      await route.fulfill({ status: 401, json: { error: "请先登录或注册账号。" } });
      return;
    }

    await route.fulfill({ json: { user: { email: "user@qq.com" } } });
  });
  await page.route("**/api/auth", async (route) => {
    authenticated = true;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/logout", async (route) => {
    authenticated = false;
    await route.fulfill({ json: { ok: true } });
  });
  await page.route("**/api/conversations**", async (route) => {
    if (!authenticated) {
      await route.fulfill({ status: 401, json: { error: "请先登录或注册账号。" } });
      return;
    }

    if (route.request().method() === "GET") {
      await route.fulfill({ json: { conversations: [] } });
      return;
    }

    await route.fulfill({
      json: {
        conversation: {
          id: "c1",
          title: "新会话",
          app_id: "mamanshuo",
          persona_id: "maman",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      },
    });
  });
}

test("user registers from the home gate and sees the app hub account state", async ({ page }) => {
  await mockAccount(page, false);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "登录或注册" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "聊天入口" })).toBeHidden();

  await page.getByRole("button", { name: "注册" }).click();
  await page.getByLabel("QQ 邮箱").fill("user@qq.com");
  await page.getByLabel("密码").fill("password123");
  await page.getByRole("button", { name: "注册账号" }).click();

  await expect(page.getByRole("heading", { name: "聊天入口" })).toBeVisible();
  await expect(page.getByText("已登录")).toBeVisible();
  await expect(page.getByText("user@qq.com")).toBeVisible();
  await expect(page.getByRole("link", { name: "进入慢慢说" })).toHaveAttribute("href", "/apps/mamanshuo");
  await expect(page.getByRole("heading", { name: "和名人对话" })).toBeVisible();
});

test("user logs out and returns to the login form", async ({ page }) => {
  await mockAccount(page);

  await page.goto("/");

  await expect(page.getByRole("heading", { name: "聊天入口" })).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();

  await expect(page.getByRole("heading", { name: "登录或注册" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "聊天入口" })).toBeHidden();
});

test("home example questions open the matching chat page without auto-sending", async ({ page }) => {
  await mockAccount(page);
  const chatRequests: unknown[] = [];
  await page.route("**/api/chat", async (route) => {
    chatRequests.push(route.request().postDataJSON());
    await route.fulfill({ status: 500, json: { error: "unexpected send" } });
  });

  await page.goto("/");
  await page.getByRole("link", { name: "我有点累" }).click();

  await expect(page).toHaveURL(/\/apps\/mamanshuo\?prompt=/);
  await expect(page.getByRole("textbox", { name: "消息输入" })).toHaveValue(
    "我有点累，但又说不清楚哪里累。请陪我慢慢梳理一下。",
  );
  expect(chatRequests).toHaveLength(0);
});

test("chat page renders streamed assistant replies", async ({ page }) => {
  await mockAccount(page);
  await page.route("**/api/chat", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({ message: "你好" });
    await route.fulfill({
      body:
        'event: conversation\ndata: {"conversationId":"c1"}\n\n' +
        'event: delta\ndata: {"content":"收到"}\n\n' +
        'event: delta\ndata: {"content":"啦"}\n\n' +
        "event: done\ndata: {}\n\n",
      contentType: "text/event-stream; charset=utf-8",
      status: 200,
    });
  });

  await page.goto("/apps/mamanshuo");

  await page.getByRole("textbox", { name: "消息输入" }).fill("你好");
  await page.keyboard.press("Enter");

  await expect(page.getByText("收到啦")).toBeVisible();
});

test("mobile chat keeps history in a drawer and quick prompts within the viewport", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAccount(page);

  await page.goto("/apps/mamanshuo");

  await expect(page.getByText("今天想先说点什么？")).toBeVisible();
  await expect(page.getByRole("complementary", { name: "历史对话" })).toBeHidden();
  await expect(page.getByRole("button", { exact: true, name: "有点累" })).toBeVisible();

  await page.getByRole("button", { name: "打开历史对话" }).click();
  await expect(page.getByRole("dialog", { name: "历史对话" })).toBeVisible();
  await expect(page.getByRole("button", { name: "新建对话" })).toBeVisible();

  await page.getByRole("button", { name: "关闭历史对话" }).click();
  await expect(page.getByRole("dialog", { name: "历史对话" })).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(
    true,
  );
});

test("celebrity chat sends the selected advisor persona", async ({ page }) => {
  await mockAccount(page);
  await page.route("**/api/chat", async (route) => {
    expect(route.request().postDataJSON()).toMatchObject({
      appId: "celebrities",
      message: "专业怎么选",
      personaId: "zhangxuefeng",
    });
    await route.fulfill({
      body:
        'event: conversation\ndata: {"conversationId":"c2","appId":"celebrities","personaId":"zhangxuefeng"}\n\n' +
        'event: delta\ndata: {"content":"先看就业"}\n\n' +
        "event: done\ndata: {}\n\n",
      contentType: "text/event-stream; charset=utf-8",
      status: 200,
    });
  });

  await page.goto("/apps/celebrities");

  await expect(page.getByRole("heading", { name: "和名人对话" })).toBeVisible();
  const sidebar = page.getByRole("complementary", { name: "人物和历史侧栏" });
  await expect(sidebar).toBeVisible();
  await expect(sidebar.getByRole("link", { name: "返回首页" })).toHaveAttribute("href", "/");
  await expect(sidebar.getByRole("button", { name: /张一鸣/ })).toBeVisible();
  await sidebar.getByRole("button", { name: /张雪峰/ }).click();
  await expect(page.getByRole("button", { name: "专业怎么选？" })).toBeVisible();
  await page.getByRole("textbox", { name: "消息输入" }).fill("专业怎么选");
  await page.keyboard.press("Enter");

  await expect(page.getByText("先看就业")).toBeVisible();
});

test("mobile celebrity chat opens advisor picker from the center icon", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockAccount(page);

  await page.goto("/apps/celebrities");

  await page.getByRole("button", { name: "选择名人顾问" }).click();
  await expect(page.getByRole("dialog", { name: "选择名人顾问" })).toBeVisible();
  await page.getByRole("dialog", { name: "选择名人顾问" }).getByRole("button", { name: /张雪峰/ }).click();

  await expect(page.getByRole("dialog", { name: "选择名人顾问" })).toBeHidden();
  await expect(page.getByText(/当前顾问：张雪峰/)).toBeVisible();
});
