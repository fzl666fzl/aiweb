# AI 问答网站 v1 设计规格

## Summary

从空目录 `D:\creat\aiweb` 新建一个可公开给少量人使用的 AI 问答网站。v1 使用共享访问密码控制访问，密码哈希存数据库；每个浏览器匿名身份只能看到自己的历史；回答完整返回后一次性展示；服务端调用 OpenAI-compatible 中转 API，浏览器不接触模型 API Key。

推荐技术栈：

- Next.js App Router + TypeScript
- Tailwind CSS
- Supabase Postgres
- Vercel
- OpenAI-compatible 中转 API，例如 `https://api.shareai.codes/v1`

## 功能范围

v1 包含：

- 访问密码页：未通过访问密码时不能进入聊天功能。
- 聊天页：输入问题、发送、显示完整回答、错误提示和加载状态。
- 多轮对话：同一会话内携带上下文请求模型。
- 历史记录：加载自己的会话列表、创建会话、继续会话、删除会话。
- 历史隔离：共享访问密码只做准入；历史按浏览器匿名 `visitor_id` 隔离。
- 双层限额：共享访问密码每日最多 100 次请求；单浏览器每日最多 30 次请求；单次输入最多 4000 字符。
- 服务端安全：模型 API Key、Supabase service role key、访问密码签名密钥只存在服务端环境变量。

v1 不包含：

- 正式注册登录
- 付费系统
- 管理后台
- 流式输出
- 文件上传
- 多模型切换 UI
- 会话分享链接

## 页面流程

首次访问：

1. 用户打开首页。
2. 如果没有有效登录 cookie，显示访问密码页。
3. 用户输入共享访问密码。
4. 后端计算密码哈希并查询 `access_keys`。
5. 校验成功后设置 HttpOnly 登录 cookie，并确保浏览器有匿名 `visitor_id` cookie。
6. 前端进入聊天页。

聊天流程：

1. 页面加载当前 `visitor_id` 的会话列表。
2. 没有会话时显示空状态。
3. 用户输入问题并发送。
4. 前端调用 `POST /api/chat`。
5. 后端校验登录状态、输入长度和每日限额。
6. 后端读取当前会话最近上下文并调用中转 API。
7. 中转 API 完整返回后，后端保存用户消息和助手消息。
8. 前端一次性展示回答并刷新会话列表。

删除会话流程：

1. 用户点击删除会话。
2. 前端调用删除接口。
3. 后端确认会话属于当前 `access_key_id + visitor_id`。
4. 后端删除会话，消息通过外键级联删除。
5. 前端移除该会话，返回空状态或切换到其他会话。

## API 设计

`POST /api/auth`

- Body: `{ "code": string }`
- 成功：设置 HttpOnly auth cookie，返回 `{ "ok": true }`
- 失败：返回 `401`

`GET /api/conversations`

- 返回当前浏览器匿名身份拥有的会话列表。

`POST /api/conversations`

- Body 可为空，也可传 `{ "title": string }`
- 创建当前浏览器匿名身份下的新会话。

`GET /api/conversations/[id]/messages`

- 返回当前浏览器拥有的某个会话消息。
- 如果会话不属于当前 `visitor_id`，返回 `404`。

`DELETE /api/conversations/[id]`

- 删除当前浏览器拥有的某个会话及其消息。
- 如果会话不属于当前 `visitor_id`，返回 `404`。

`POST /api/chat`

- Body: `{ "conversationId"?: string, "message": string }`
- `conversationId` 为空时创建新会话。
- 成功返回：`{ "conversationId": string, "assistantMessage": { "role": "assistant", "content": string, "createdAt": string } }`

## 数据库设计

`access_keys`

```sql
create table access_keys (
  id uuid primary key default gen_random_uuid(),
  label text not null,
  key_hash text unique not null,
  enabled boolean not null default true,
  daily_limit integer not null default 100,
  created_at timestamptz not null default now()
);
```

`conversations`

```sql
create table conversations (
  id uuid primary key default gen_random_uuid(),
  access_key_id uuid not null references access_keys(id),
  visitor_id text not null,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
```

`messages`

```sql
create table messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
```

`usage_logs`

```sql
create table usage_logs (
  id uuid primary key default gen_random_uuid(),
  access_key_id uuid not null references access_keys(id),
  visitor_id text not null,
  usage_date date not null,
  request_count integer not null default 0,
  unique (access_key_id, visitor_id, usage_date)
);
```

建议索引：

```sql
create index conversations_owner_idx
  on conversations (access_key_id, visitor_id, updated_at desc);

create index messages_conversation_idx
  on messages (conversation_id, created_at asc);

create index usage_logs_date_idx
  on usage_logs (access_key_id, usage_date);
```

## 鉴权和限额

访问密码不存明文。服务端用 `APP_ACCESS_SECRET` 对用户输入的访问密码生成确定性哈希，再查询 `access_keys.key_hash`。

登录成功后，服务端设置：

- HttpOnly auth cookie：包含已签名的 `access_key_id`。
- HttpOnly 或普通 cookie `visitor_id`：随机生成的浏览器匿名标识。若前端无需读取，优先使用 HttpOnly。

限额规则：

- 访问密码每日总请求上限：`access_keys.daily_limit`，默认 100。
- 单浏览器每日请求上限：30。
- 单次输入最大长度：4000 字符。

限额检查应尽量使用数据库函数完成原子检查和递增，避免并发请求绕过限制。

## 风险和处理

- 共享密码泄露：使用访问密码总限额控制整体成本；必要时可停用 `access_keys.enabled`。
- 单人刷量：使用单浏览器每日限额降低影响。
- 匿名身份丢失：用户清除 cookie 或换浏览器后无法看到旧历史；v1 接受这个限制。
- 中转 API 不稳定：超时、限流、模型名错误时前端显示友好错误，不保存假助手回答。
- 数据库泄露：数据库只保存访问密码哈希，不保存明文访问密码。
- 上下文过长：v1 只发送最近若干条消息或限制上下文总字符数，避免请求体过大。
- API Key 暴露：客户端不得读取或渲染任何模型密钥、Supabase service role key 或访问签名密钥。

## 成功标准

- 没有访问密码不能聊天。
- 正确访问密码可以进入聊天页。
- 一次问答可以成功保存并展示。
- 刷新页面后可以看到自己的历史会话。
- 另一个浏览器或无痕窗口看不到原浏览器历史。
- 用户可以删除自己的会话。
- 超过每日限额后返回明确错误。
- 中转 API 报错或超时时，页面显示友好错误。
- 浏览器网络请求和页面源码中看不到模型 API Key。

