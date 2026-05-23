# 课件复习助手上传总结功能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有 AI 小站里新增第三个应用「复习助手」：用户登录后可以上传课件文件，系统只提取并保存文字，不保存原文件，然后围绕课件进行总结、考点提炼、复习提纲和自测题对话。

**Architecture:** 复用现有 Next.js App Router、账号门禁、`ChatApp` 通用聊天界面、Supabase 所有权过滤和 `/api/chat` 流式回答。新增一个服务端上传解析接口 `/api/study/extract`，把提取出的文字写入 `study_materials` 表；聊天时由 `/api/chat` 校验该课件属于当前用户，再把课件文字作为隐藏 system context 注入模型请求。

**Tech Stack:** Next.js 16.2.6 App Router, React 19, Supabase Postgres, Vercel Functions, Vitest, Playwright, `pdf-parse`, `mammoth`, `jszip`, `fast-xml-parser`。图片 OCR 第一版走现有 OpenAI-compatible 中转站的视觉模型能力；如果中转站不支持图片，给用户友好失败提示。

---

## 0. Scope and Assumptions

第一版只做「够用、可上线、可验证」：

- 首页新增应用卡片：`复习助手`。
- 新增页面：`/apps/study`。
- 支持上传：`.pdf`, `.pptx`, `.docx`, `.png`, `.jpg`, `.jpeg`, `.webp`。
- 友好拒绝：`.ppt`, `.doc`，提示另存为 PPTX/DOCX/PDF。
- 不保存原始文件，不接 Supabase Storage。
- Supabase 只保存文件名、类型、提取文字、预览摘要、长度、用户归属、会话归属。
- 用户只能看到和使用自己的课件材料、会话和消息。
- 上传解析本身不扣每日聊天额度；真正发送 `/api/chat` 时沿用现有 daily limit。
- 移动端上传面板不能挡住聊天主流程，快捷问题横向滚动，不造成页面横向溢出。

明确不做：

- 多文件一次上传。
- 长期文件库和文件预览。
- `.ppt` / `.doc` 老 Office 二进制解析。
- 扫描版 PDF OCR。
- RAG、向量库、分块检索。
- 老师端、班级空间、分享链接。

重要限制：

- 上传大小先限制为 `4 MB`，降低 Vercel request body 和 serverless 运行时间风险。
- 提取文字最多保存 `60000` 字符；注入模型上下文最多 `16000` 字符，避免超长上下文拖慢或失败。
- 图片 OCR 需要中转站和模型支持 vision message 格式；如果不支持，图片上传会失败，但 PDF/PPTX/DOCX 不受影响。

## 1. Before Coding Checklist

- [ ] 阅读 `AGENTS.md`，遵守「小改动、先测试、不要无关重构」。
- [ ] 阅读 Next.js 16 文档：
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md`
  - `node_modules/next/dist/docs/01-app/02-guides/forms.md`
  - `node_modules/next/dist/docs/01-app/02-guides/data-security.md`
- [ ] 确认当前分支和工作树，不碰无关的 `submission-proof/`。
- [ ] 实现过程中不提交 git commit，除非用户明确要求“提交/部署”。

## 2. File Map

Create:

- `src/app/apps/study/page.tsx`  
  复习助手页面，包一层 `SessionProvider`，渲染 `StudyApp`。

- `src/components/StudyApp.tsx`  
  客户端包装组件，管理上传材料状态，并把上传面板和 `studyMaterialId` 传给 `ChatApp`。

- `src/components/StudyUploadPanel.tsx`  
  上传 UI：选择文件、读取中、文件 chip、预览摘要、移除按钮、错误提示。

- `src/app/api/study/extract/route.ts`  
  上传解析 Route Handler：校验登录、读取 `FormData`、校验类型/大小、提取文字、写入 Supabase。

- `src/lib/study/types.ts`  
  `StudyMaterial` 和 `StudyExtractResult` 类型。

- `src/lib/study/extractors.ts`  
  PDF/DOCX/PPTX/图片提取逻辑和文件校验。

- `supabase/migrations/202605240001_add_study_materials.sql`  
  新增 `study_materials` 表，只存提取文字，不存原文件。

- `tests/unit/study-extractors.test.ts`  
  文件类型、大小、空内容、PPTX 文字提取的单测。

- `tests/unit/study-extract-route.test.ts`  
  上传接口的鉴权、校验、成功写入、错误返回单测。

Modify:

- `package.json`, `package-lock.json`  
  新增解析依赖。

- `src/lib/personas.ts`  
  新增 `appId: "study"` 和 `personaId: "study-helper"`。

- `src/lib/persona-prompts.ts`  
  新增复习助手 system prompt。

- `src/lib/prompt-suggestions.ts`  
  新增复习快捷问题。

- `src/components/HomeContent.tsx`  
  首页应用广场新增复习助手卡片和示例问题。

- `src/components/ChatApp.tsx`  
  增加小型扩展点：`composerTopContent`、`chatRequestContext`、可选 `placeholder`。

- `src/lib/client-api.ts`  
  修复 `FormData` 请求不能强行设置 `Content-Type: application/json`。

- `src/lib/ai.ts`  
  新增 `callVisionTextExtraction`，不改变现有文本聊天路径。

- `src/app/api/chat/route.ts`  
  对 `appId: "study"` 读取并注入当前用户自己的课件上下文。

- Tests:
  - `tests/unit/personas.test.ts`
  - `tests/unit/HomePage.test.tsx`
  - `tests/unit/ChatApp.test.tsx`
  - `tests/unit/chat-route.test.ts`
  - `tests/e2e/chat.spec.ts`

## 3. Task Breakdown

### Task 1: Study App Persona and Prompt

**Goal:** 让系统识别第三个 app：`study`。

**Files:**

- Modify: `src/lib/personas.ts`
- Modify: `src/lib/persona-prompts.ts`
- Modify: `src/lib/prompt-suggestions.ts`
- Modify: `tests/unit/personas.test.ts`

- [ ] 写失败测试：`isAppId("study")` 为 true，默认 persona 是 `study-helper`。
- [ ] 运行：`npm test -- tests/unit/personas.test.ts`，确认失败。
- [ ] 在 `APP_IDS` 加入 `"study"`。
- [ ] 在 `PersonaId` 加入 `"study-helper"`。
- [ ] 新增 persona：

```ts
{
  id: "study-helper",
  appId: "study",
  name: "复习助手",
  description: "帮你把课件整理成重点、考点、提纲和自测题。",
  suitableFor: "课件总结、考点提炼、章节复习、自测题生成",
  source: "项目内置学习助教提示词",
}
```

- [ ] `DEFAULT_PERSONA_BY_APP.study = "study-helper"`。
- [ ] 在 `persona-prompts.ts` 新增复习助手 prompt，核心规则：
  - 优先依据课件内容。
  - 不编造课件没有的信息。
  - 课件不足时明确说明。
  - 输出面向考试复习，分层清楚。
  - 可以生成提纲、考点、自测题、易错点。
- [ ] 在 `prompt-suggestions.ts` 新增快捷问题：
  - `总结课件`
  - `提炼考点`
  - `生成自测题`
  - `按章节复习`
- [ ] 运行：`npm test -- tests/unit/personas.test.ts`，确认通过。

### Task 2: Supabase Migration

**Goal:** 保存提取文字和归属信息，不保存文件本体。

**Files:**

- Create: `supabase/migrations/202605240001_add_study_materials.sql`

- [ ] 新建 SQL：

```sql
create table if not exists study_materials (
  id uuid primary key default gen_random_uuid(),
  access_key_id uuid not null references access_keys(id),
  visitor_id text not null,
  conversation_id uuid references conversations(id) on delete cascade,
  file_name text not null,
  mime_type text not null,
  extracted_text text not null,
  summary_preview text not null,
  text_length integer not null,
  created_at timestamptz not null default now()
);

create index if not exists study_materials_owner_idx
  on study_materials (access_key_id, visitor_id, created_at desc);

create index if not exists study_materials_conversation_idx
  on study_materials (conversation_id);
```

- [ ] 说明上线前需要在 Supabase SQL Editor 执行该文件内容。
- [ ] 本地不需要真实 Supabase 即可跑单测；生产必须先执行 migration 再部署。

### Task 3: Parser Dependencies

**Goal:** 安装最小必要解析库。

**Files:**

- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] 运行：

```powershell
npm install pdf-parse mammoth jszip fast-xml-parser
```

- [ ] 确认只新增必要依赖，没有引入大 UI 库或无关包。

### Task 4: Server-Side Extractors

**Goal:** 在服务端把课件转成可用于模型的纯文本。

**Files:**

- Create: `src/lib/study/types.ts`
- Create: `src/lib/study/extractors.ts`
- Create: `tests/unit/study-extractors.test.ts`
- Modify: `src/lib/ai.ts`

- [ ] 写失败测试：
  - 支持 PDF/PPTX/DOCX/PNG/JPG/WEBP。
  - 拒绝 `.ppt` / `.doc`，提示另存。
  - 拒绝超过 4MB。
  - 空文本抛出友好错误。
  - 用最小 PPTX fixture 验证可以提取 slide 文本。
- [ ] 运行：`npm test -- tests/unit/study-extractors.test.ts`，确认失败。
- [ ] 定义类型：

```ts
export type StudyMaterial = {
  id: string;
  fileName: string;
  mimeType: string;
  summaryPreview: string;
  textLength: number;
};

export type StudyExtractResult = {
  fileName: string;
  mimeType: string;
  extractedText: string;
  summaryPreview: string;
  textLength: number;
};
```

- [ ] 实现 `validateStudyFile(file)`：
  - `size > 4MB` 返回 413。
  - `.ppt` / `.doc` 返回 415 和转换提示。
  - 其他不支持类型返回 415。
- [ ] 实现 `extractStudyText(file)`：
  - PDF：`pdf-parse`。
  - DOCX：`mammoth.extractRawText`。
  - PPTX：`jszip` 读取 `ppt/slides/slide*.xml`，`fast-xml-parser` 提取文本节点。
  - 图片：调用新增 `callVisionTextExtraction`。
  - 统一 normalize 空格和换行。
  - 少于 20 字符提示“没有读取到可用文字”。
  - 最多截取 60000 字符保存。
- [ ] 在 `src/lib/ai.ts` 新增 `callVisionTextExtraction`：
  - 使用 `/chat/completions`。
  - message content 使用 `text + image_url`。
  - 超时 60 秒。
  - 不改变现有 `streamChatCompletion`。
- [ ] 运行：`npm test -- tests/unit/study-extractors.test.ts`，确认通过。

### Task 5: Upload Route

**Goal:** 登录用户上传文件后，服务端提取文字并写入 Supabase。

**Files:**

- Create: `src/app/api/study/extract/route.ts`
- Create: `tests/unit/study-extract-route.test.ts`

- [ ] 写失败测试：
  - 未登录返回 401。
  - 缺少文件返回 400。
  - 不支持格式返回 415。
  - 超过 4MB 返回 413。
  - 成功时调用 `extractStudyText`，向 `study_materials` insert 当前 `access_key_id` 和 `visitor_id`。
  - 返回体不包含 `extracted_text`，只返回 `material` 摘要。
- [ ] 运行：`npm test -- tests/unit/study-extract-route.test.ts`，确认失败。
- [ ] 实现 `POST`：
  - `requireSession()`。
  - `await request.formData()`。
  - `formData.get("file") instanceof File`。
  - `validateStudyFile(file)`，失败直接返回对应状态。
  - `extractStudyText(file)`。
  - `createSupabaseAdmin().from("study_materials").insert(...).select(...).single()`。
  - 返回：

```ts
{
  material: {
    id,
    fileName,
    mimeType,
    summaryPreview,
    textLength
  }
}
```

- [ ] 错误提示保持用户可理解，不返回密钥、SQL、堆栈。
- [ ] 运行：`npm test -- tests/unit/study-extract-route.test.ts`，确认通过。

### Task 6: Chat Context Injection

**Goal:** 用户发送复习问题时，模型能看到当前课件文本。

**Files:**

- Modify: `src/app/api/chat/route.ts`
- Modify: `tests/unit/chat-route.test.ts`

- [ ] 写失败测试：
  - `appId: "study"` + `studyMaterialId` 时，查询 `study_materials` 必须带 `access_key_id` 和 `visitor_id`。
  - 未找到材料返回 404。
  - 材料如果还没有 `conversation_id`，首次发送时绑定当前 conversation。
  - 材料如果已绑定到别的 conversation，返回 404。
  - 调用 `streamChatCompletion` 时，messages 中第二条 system context 包含课件文件名和文字。
  - `messages` 表只保存用户消息和 AI 回答，不保存课件 system context。
- [ ] 运行：`npm test -- tests/unit/chat-route.test.ts`，确认失败。
- [ ] 新增 helper：
  - `resolveStudyMaterials(body, conversation, session, supabase)`
  - `buildStudyContextMessage(materials)`
- [ ] `STUDY_CONTEXT_LIMIT = 16000`。
- [ ] 构建 messages 顺序：
  - persona system prompt
  - study material system context，只有 study app 且有材料时加入
  - 历史消息
  - 当前用户消息
- [ ] catch 中把“课件不存在或已失效。”映射为 404。
- [ ] 运行：`npm test -- tests/unit/chat-route.test.ts`，确认通过。

### Task 7: ChatApp Extension Points

**Goal:** 不重构聊天框，只给复习助手插入上传面板和额外请求字段。

**Files:**

- Modify: `src/components/ChatApp.tsx`
- Modify: `src/lib/client-api.ts`
- Modify: `tests/unit/ChatApp.test.tsx`

- [ ] 写失败测试：
  - `composerTopContent` 能显示在输入框上方。
  - `chatRequestContext={{ studyMaterialId: "material-1" }}` 会合并进 `/api/chat` 请求 body。
  - 点击复习快捷问题只填入输入框，不自动发送。
- [ ] 运行：`npm test -- tests/unit/ChatApp.test.tsx`，确认失败。
- [ ] `ChatAppProps` 新增：

```ts
composerTopContent?: React.ReactNode;
chatRequestContext?: Record<string, unknown>;
placeholder?: string;
```

- [ ] 发送请求 body 改为：

```ts
JSON.stringify({
  appId,
  conversationId: activeId,
  message: content,
  personaId: selectedPersonaId,
  ...chatRequestContext,
})
```

- [ ] 在 `Composer` 上方渲染 `{composerTopContent}`。
- [ ] `placeholder` 透传给 `Composer`。
- [ ] 修改 `apiJson`：当 `init.body instanceof FormData` 时不要设置 `Content-Type`，让浏览器自动生成 multipart boundary。
- [ ] 运行：`npm test -- tests/unit/ChatApp.test.tsx`，确认通过。

### Task 8: Study Page and Upload UI

**Goal:** `/apps/study` 页面可上传文件并进入聊天。

**Files:**

- Create: `src/components/StudyUploadPanel.tsx`
- Create: `src/components/StudyApp.tsx`
- Create: `src/app/apps/study/page.tsx`
- Modify: `tests/unit/ChatApp.test.tsx` or add `tests/unit/StudyApp.test.tsx`

- [ ] 写 UI 测试：
  - 上传面板显示“上传课件开始复习”。
  - 成功上传后显示文件名、摘要和“移除”按钮。
  - 上传失败显示 `role="alert"`。
  - 移除后不再向 chat body 发送 `studyMaterialId`。
- [ ] 实现 `StudyUploadPanel`：
  - `aria-label="课件上传"`。
  - input accept 限制目标格式。
  - disabled/loading 状态。
  - 文件说明：`支持 PDF、PPTX、DOCX 和常见图片，不保存原文件。`
- [ ] 实现 `StudyApp`：
  - `useState` 保存 `material/uploading/error`。
  - 上传时 `FormData` POST `/api/study/extract`。
  - 成功设置 `material`。
  - 失败清空 `material` 并显示友好错误。
  - 渲染 `ChatApp appId="study"`。
- [ ] 实现页面：

```tsx
import { StudyApp } from "@/components/StudyApp";
import { SessionProvider } from "@/components/SessionProvider";

export default function StudyPage() {
  return (
    <SessionProvider>
      <StudyApp />
    </SessionProvider>
  );
}
```

- [ ] 移动端检查：上传面板高度紧凑，不挡住消息区；按钮不横向撑破。

### Task 9: Homepage Entry

**Goal:** 用户第一次打开首页就能发现复习助手。

**Files:**

- Modify: `src/components/HomeContent.tsx`
- Modify: `tests/unit/HomePage.test.tsx`

- [ ] 写失败测试：
  - 首页登录后显示 `复习助手`。
  - 显示描述：`上传课件，帮你总结重点、整理考点、生成自测题。`
  - 示例问题链接到 `/apps/study?prompt=...`。
- [ ] 在 `apps` 数组里新增卡片：

```ts
{
  title: "复习助手",
  status: "已开放",
  description: "上传课件，帮你总结重点、整理考点、生成自测题。",
  href: "/apps/study",
  action: "进入复习助手",
  examples: [
    { label: "帮我总结课件", prompt: "请帮我总结这份课件，先列核心知识点，再给复习提纲。" },
    { label: "提炼考试重点", prompt: "请根据这份课件提炼可能考试的重点、易错点和简答题方向。" },
    { label: "出几道自测题", prompt: "请根据这份课件生成 10 道自测题，并附参考答案。" }
  ]
}
```

- [ ] 运行：`npm test -- tests/unit/HomePage.test.tsx`，确认通过。

### Task 10: E2E Coverage

**Goal:** 覆盖真实用户路径和移动端布局风险。

**Files:**

- Modify: `tests/e2e/chat.spec.ts`

- [ ] 新增 e2e：登录后首页能看到 `复习助手` 并进入。
- [ ] 新增 e2e：拦截 `/api/study/extract` 返回 mock material，上传后显示文件名。
- [ ] 新增 e2e：发送消息时 `/api/chat` body 包含：

```json
{
  "appId": "study",
  "personaId": "study-helper",
  "studyMaterialId": "material-1"
}
```

- [ ] 新增 e2e：移动端 `/apps/study` 无横向溢出：

```ts
expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
```

- [ ] 运行：`npm run test:e2e`。

## 4. Verification Plan

每完成一个 task 先跑对应测试。全部实现后运行：

```powershell
npm test
npm run lint
npm run build
npm run test:e2e
```

如果 `npm run build` 因 Next.js 16 行为失败，先回到 `node_modules/next/dist/docs/01-app/` 查相关文档，再改代码。

本地浏览器 smoke test：

- 打开 `/`，登录后看到 `复习助手`。
- 进入 `/apps/study`。
- 上传一个小 DOCX/PPTX/PDF。
- 页面显示文件名和摘要。
- 点击快捷问题只填入输入框，不自动发送。
- 发送 `请帮我总结这份课件`。
- AI 流式返回回答。
- 刷新后会话仍在历史里。
- 删除会话后会话消失。
- 移动端无横向滚动。

## 5. Supabase and Deployment Notes

生产部署前必须执行：

- SQL 文件：`supabase/migrations/202605240001_add_study_materials.sql`
- 执行位置：Supabase 项目的 SQL Editor。

环境变量：

- 必需：沿用现有 `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_ACCESS_SECRET`。
- 可选：`AI_VISION_MODEL`，当图片 OCR 需要单独 vision 模型时设置。

部署顺序建议：

1. 本地测试全绿。
2. Supabase 执行 migration。
3. 推送代码。
4. Vercel Production redeploy。
5. 线上用小文件做 smoke test。

## 6. Risk Checklist

- **隐私风险:** 不保存原文件，但提取文字仍可能包含课程内容或个人信息，所以只能按当前账号归属访问。
- **中转站能力风险:** 图片 OCR 取决于模型是否支持 vision；失败时不影响 PDF/PPTX/DOCX。
- **文件大小风险:** 4MB 可能不够大，但适合第一版上线；后续可做临时对象存储处理大文件。
- **扫描 PDF 风险:** 扫描 PDF 没有文字层，第一版会提示无法读取。
- **上下文长度风险:** 保存 60000 字，但只注入 16000 字，后续可做分块检索。
- **数据库迁移风险:** 未执行 migration 时 `/api/study/extract` 会失败；上线前必须执行。
- **移动端风险:** 上传面板和快捷问题都要保持紧凑，e2e 检查横向溢出。

## 7. Done Definition

- `复习助手` 出现在首页应用广场。
- `/apps/study` 登录后可访问，未登录仍只能看到登录/注册。
- 支持上传 PDF/PPTX/DOCX/图片，老格式和超大文件有友好提示。
- 原文件不保存，Supabase 只保存提取文字和元数据。
- 聊天请求能把当前用户自己的课件文字注入模型上下文。
- 用户不能使用别人的 `studyMaterialId`。
- 快捷问题只填入输入框，不自动发送。
- `npm test`、`npm run lint`、`npm run build`、`npm run test:e2e` 全部通过。
- 生产环境执行 migration 后可部署并完成线上 smoke test。

