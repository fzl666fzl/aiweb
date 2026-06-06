# 会员充值与兑换码设计

## 目标

把会员充值做成可落地的闭环：链动小铺负责收款和自动发货，网站负责兑换码校验、会员开通、额度生效和到期降级。

## 用户流程

1. 用户登录网站后，在会员额度区域看到一个 `充值 / 升级` 按钮。
2. 用户点击按钮，弹出充值窗口。
3. 窗口里展示 Plus 和 Pro 套餐、价格、额度、链动小铺购买按钮，以及兑换码输入框。
4. 用户在链动小铺付款后获得兑换码。
5. 用户回到网站输入兑换码。
6. 网站兑换成功后刷新账号状态，展示新的会员档位、到期时间和本月额度。

## 收费策略

- Free：免费，每月 50 次。
- Plus：¥19 / 月，每月 500 次。
- Pro：¥59 / 月，每月 2000 次。

第一版不做余额充值、按次购买、年费折扣和自动支付回调。这样可以先降低支付、退款、对账和合规复杂度。

## 技术设计

### 数据表

`app_users` 增加：

- `membership_expires_at timestamptz`：会员到期时间。为空或已过期时按 Free 处理。

新增 `membership_codes`：

- `code_hash text unique not null`：兑换码哈希，避免数据库明文存码。
- `tier text not null check (tier in ('plus', 'pro'))`：兑换后开通的档位。
- `duration_days integer not null`：有效天数，月卡默认 31 天。
- `redeemed_by_user_id uuid references app_users(id)`：兑换用户。
- `redeemed_at timestamptz`：兑换时间。
- `created_at timestamptz`：创建时间。

### 兑换接口

新增 `POST /api/membership/redeem`：

- 要求用户已登录。
- 接收 `{ code: string }`。
- 使用 `MEMBERSHIP_CODE_SECRET` 计算兑换码哈希；未配置时回退到 `APP_ACCESS_SECRET`。
- 查找未兑换的 `membership_codes`。
- 如果不存在或已兑换，返回 400。
- 如果有效，按当前会员到期时间续期：
  - 如果用户当前同档会员未过期，从原到期时间继续加 `duration_days`。
  - 其他情况从当前时间起加 `duration_days`。
- 更新 `app_users.membership_tier` 和 `membership_expires_at`。
- 标记兑换码已使用。
- 返回新的会员摘要，前端刷新 session。

### 额度判定

聊天限额使用一个统一的会员解析函数：

- 如果 `membership_tier` 是 Plus/Pro 且 `membership_expires_at` 晚于当前时间，按该档位月额度。
- 如果过期或为空，按 Free 月额度。

`/api/me` 同样返回有效档位和到期时间，保证 UI 与后端限额一致。

### 购买链接配置

链动小铺商品链接默认使用当前生产商品链接，也可以通过环境变量覆盖：

- `NEXT_PUBLIC_LDXP_PLUS_URL`
- `NEXT_PUBLIC_LDXP_PRO_URL`

如果既没有默认链接也没有配置环境变量，按钮展示“暂未配置购买链接”，避免空链接误导用户。

### 生成卡密

新增脚本 `scripts/generate-membership-codes.mjs`：

```bash
node scripts/generate-membership-codes.mjs plus 100
node scripts/generate-membership-codes.mjs pro 100
```

脚本输出：

- 兑换码明文：导入链动小铺自动发货。
- SQL insert：导入 Supabase 的 `membership_codes` 表。

脚本只在终端输出，不自动写数据库，不保存明文文件，避免误提交卡密。

## 错误处理

- 未登录：401，提示先登录。
- 空兑换码：400，提示请输入兑换码。
- 无效或已使用：400，提示兑换码无效或已使用。
- 数据库异常：500，提示兑换失败稍后重试。

## 测试

- 会员策略测试：过期会员降级为 Free，有效 Plus/Pro 生效。
- `/api/me` 测试：返回有效档位、用量、到期时间。
- 聊天接口测试：过期会员按 Free 限额，有效会员按对应档位限额。
- 兑换接口测试：成功兑换、重复兑换、未登录、空码。
- UI 测试：会员区只显示充值按钮，点击弹窗后显示购买入口和兑换表单。
