import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { hashPassword, normalizeEmail, validatePassword, verifyPassword } from "@/lib/account-auth";
import { AUTH_COOKIE, VISITOR_COOKIE, hashAccessCode, signAccessToken } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getOrCreateVisitorId } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

type AccountUser = {
  id: string;
  access_key_id: string;
  password_hash: string;
  password_salt: string;
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const hasAccountFields = typeof body.email === "string" || typeof body.password === "string";

  if (hasAccountFields) {
    return handleAccountAuth(body);
  }

  return handleAccessCodeAuth(body);
}

async function handleAccountAuth(body: Record<string, unknown>) {
  const mode = body.mode === "register" ? "register" : body.mode === "login" ? "login" : null;

  if (!mode) {
    return NextResponse.json({ error: "未知的账号操作。" }, { status: 400 });
  }

  const rawEmail = typeof body.email === "string" ? body.email : "";
  const email = normalizeEmail(rawEmail);

  if (!email) {
    return NextResponse.json(
      { error: mode === "register" ? "注册账号只能使用 QQ 邮箱。" : "请使用 QQ 邮箱登录。" },
      { status: 400 },
    );
  }

  const password = typeof body.password === "string" ? body.password : "";
  const passwordError = validatePassword(password);

  if (passwordError) {
    return NextResponse.json({ error: passwordError }, { status: 400 });
  }

  if (mode === "register") {
    return registerAccount(email, password);
  }

  return loginAccount(email, password);
}

async function registerAccount(email: string, password: string) {
  const secret = getEnv("APP_ACCESS_SECRET");
  const supabase = createSupabaseAdmin();
  const { data: existingUser, error: existingError } = await supabase
    .from("app_users")
    .select("id")
    .eq("email", email)
    .limit(1)
    .single();

  if (existingError && existingError.code !== "PGRST116") {
    console.error("Account lookup failed", { code: existingError.code, message: existingError.message });
    return NextResponse.json({ error: "账号配置异常，请检查服务端配置。" }, { status: 500 });
  }

  if (existingUser) {
    return NextResponse.json({ error: "这个 QQ 邮箱已经注册，请直接登录。" }, { status: 409 });
  }

  const keyHash = hashAccessCode(`account:${email}:${randomUUID()}`, secret);
  const { data: accessKey, error: accessKeyError } = await supabase
    .from("access_keys")
    .insert({ daily_limit: 100, enabled: true, key_hash: keyHash, label: `account:${email}` })
    .select("id")
    .single();

  if (accessKeyError || !accessKey) {
    console.error("Account access key creation failed", accessKeyError);
    return NextResponse.json({ error: "创建账号失败，请稍后重试。" }, { status: 500 });
  }

  const passwordResult = hashPassword(password);
  const { data: user, error: userError } = await supabase
    .from("app_users")
    .insert({
      access_key_id: accessKey.id,
      email,
      enabled: true,
      password_hash: passwordResult.passwordHash,
      password_salt: passwordResult.passwordSalt,
    })
    .select("id, access_key_id")
    .single();

  if (userError || !user) {
    if (userError?.code === "23505") {
      return NextResponse.json({ error: "这个 QQ 邮箱已经注册，请直接登录。" }, { status: 409 });
    }

    console.error("Account creation failed", userError);
    return NextResponse.json({ error: "创建账号失败，请稍后重试。" }, { status: 500 });
  }

  return createSessionResponse(user.access_key_id, `user:${user.id}`, secret);
}

async function loginAccount(email: string, password: string) {
  const secret = getEnv("APP_ACCESS_SECRET");
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select("id, access_key_id, password_hash, password_salt")
    .eq("email", email)
    .eq("enabled", true)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Account login lookup failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "账号配置异常，请检查服务端配置。" }, { status: 500 });
  }

  const user = data as AccountUser | null;

  if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
    return NextResponse.json({ error: "邮箱或密码不正确。" }, { status: 401 });
  }

  return createSessionResponse(user.access_key_id, `user:${user.id}`, secret);
}

async function handleAccessCodeAuth(body: Record<string, unknown>) {
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!code) {
    return NextResponse.json({ error: "请输入访问密码。" }, { status: 400 });
  }

  const secret = getEnv("APP_ACCESS_SECRET");
  const keyHash = hashAccessCode(code, secret);
  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("access_keys")
    .select("id")
    .eq("key_hash", keyHash)
    .eq("enabled", true)
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    console.error("Access key lookup failed", { code: error.code, message: error.message });
    return NextResponse.json({ error: "登录配置异常，请检查服务端配置。" }, { status: 500 });
  }

  if (!data) {
    return NextResponse.json({ error: "访问密码不正确。" }, { status: 401 });
  }

  const visitorId = await getOrCreateVisitorId();
  return createSessionResponse(data.id, visitorId, secret);
}

async function createSessionResponse(accessKeyId: string, visitorId: string, secret: string) {
  const token = await signAccessToken({ accessKeyId }, secret);
  const response = NextResponse.json({ ok: true });
  const secure = process.env.NODE_ENV === "production";

  response.cookies.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
  });
  response.cookies.set(VISITOR_COOKIE, visitorId, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
  });

  return response;
}
