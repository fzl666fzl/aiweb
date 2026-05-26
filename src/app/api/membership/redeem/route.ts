import { NextResponse } from "next/server";
import { hashAccessCode } from "@/lib/auth";
import { getEnv } from "@/lib/env";
import { getMembershipTier, getMembershipUsagePeriod } from "@/lib/membership";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

const DAY_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "请先登录后再兑换会员。" }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const code = typeof body.code === "string" ? body.code.trim() : "";

  if (!code) {
    return NextResponse.json({ error: "请输入兑换码。" }, { status: 400 });
  }

  const supabase = createSupabaseAdmin();
  const { data: user, error: userError } = await supabase
    .from("app_users")
    .select("id, membership_tier, membership_expires_at")
    .eq("access_key_id", session.accessKeyId)
    .eq("enabled", true)
    .limit(1)
    .single();

  if (userError || !user || typeof user.id !== "string") {
    return NextResponse.json({ error: "请先登录后再兑换会员。" }, { status: 401 });
  }

  const codeHash = hashAccessCode(code, getEnv("APP_ACCESS_SECRET"));
  const { data: membershipCode, error: codeError } = await supabase
    .from("membership_codes")
    .select("id, tier, duration_days")
    .eq("code_hash", codeHash)
    .is("redeemed_at", null)
    .limit(1)
    .single();

  if (codeError || !membershipCode || typeof membershipCode.id !== "string") {
    return NextResponse.json({ error: "兑换码无效或已使用。" }, { status: 400 });
  }

  const tier = getMembershipTier(membershipCode.tier);

  if (tier.id === "free" || typeof membershipCode.duration_days !== "number") {
    return NextResponse.json({ error: "兑换码无效或已使用。" }, { status: 400 });
  }

  const now = new Date();
  const currentExpiry =
    typeof user.membership_expires_at === "string" && Date.parse(user.membership_expires_at) > now.getTime()
      ? new Date(user.membership_expires_at)
      : now;
  const nextExpiresAt = new Date(currentExpiry.getTime() + membershipCode.duration_days * DAY_MS).toISOString();
  const redeemedAt = now.toISOString();
  const { error: updateUserError } = await supabase
    .from("app_users")
    .update({ membership_expires_at: nextExpiresAt, membership_tier: tier.id })
    .eq("id", user.id);

  if (updateUserError) {
    return NextResponse.json({ error: "兑换失败，请稍后重试。" }, { status: 500 });
  }

  const { error: updateCodeError } = await supabase
    .from("membership_codes")
    .update({ redeemed_at: redeemedAt, redeemed_by_user_id: user.id })
    .eq("id", membershipCode.id);

  if (updateCodeError) {
    return NextResponse.json({ error: "兑换失败，请稍后重试。" }, { status: 500 });
  }

  const period = getMembershipUsagePeriod(now);

  return NextResponse.json({
    membership: {
      expiresAt: nextExpiresAt,
      monthlyMessageLimit: tier.monthlyMessageLimit,
      monthlyMessagesRemaining: tier.monthlyMessageLimit,
      monthlyMessagesUsed: 0,
      name: tier.name,
      periodLabel: period.label,
      tierId: tier.id,
    },
  });
}
