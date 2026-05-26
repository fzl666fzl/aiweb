import { NextResponse } from "next/server";
import { getEffectiveMembershipTier, getMembershipUsagePeriod } from "@/lib/membership";
import { requireSession } from "@/lib/session";
import { createSupabaseAdmin } from "@/lib/supabase";

export async function GET() {
  const session = await requireSession();

  if (!session) {
    return NextResponse.json({ error: "请先登录或注册账号。" }, { status: 401 });
  }

  const supabase = createSupabaseAdmin();
  const { data, error } = await supabase
    .from("app_users")
    .select("email, membership_tier, membership_expires_at")
    .eq("access_key_id", session.accessKeyId)
    .eq("enabled", true)
    .limit(1)
    .single();

  if (error || !data || typeof data.email !== "string") {
    return NextResponse.json({ error: "请先登录或注册账号。" }, { status: 401 });
  }

  const tier = getEffectiveMembershipTier(data.membership_tier, data.membership_expires_at);
  const expiresAt = tier.id === "free" ? null : typeof data.membership_expires_at === "string" ? data.membership_expires_at : null;
  const period = getMembershipUsagePeriod();
  const { data: usage, error: usageError } = await supabase
    .from("usage_logs")
    .select("request_count")
    .eq("access_key_id", session.accessKeyId)
    .eq("visitor_id", session.visitorId)
    .eq("usage_date", period.usageDate)
    .limit(1)
    .single();

  if (usageError && usageError.code !== "PGRST116") {
    return NextResponse.json({ error: "读取会员额度失败。" }, { status: 500 });
  }

  const monthlyMessagesUsed = typeof usage?.request_count === "number" ? usage.request_count : 0;

  return NextResponse.json({
    user: {
      email: data.email,
      membership: {
        tierId: tier.id,
        name: tier.name,
        monthlyMessageLimit: tier.monthlyMessageLimit,
        monthlyMessagesUsed,
        monthlyMessagesRemaining: Math.max(tier.monthlyMessageLimit - monthlyMessagesUsed, 0),
        periodLabel: period.label,
        expiresAt,
      },
    },
  });
}
