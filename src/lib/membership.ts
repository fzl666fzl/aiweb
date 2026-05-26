export const DEFAULT_MEMBERSHIP_TIER_ID = "free";

export const MEMBERSHIP_TIERS = [
  {
    id: "free",
    name: "Free",
    priceLabel: "¥0 / 月",
    description: "默认档位，适合偶尔使用。",
    monthlyMessageLimit: 50,
    benefits: ["每月 50 次 AI 对话", "可使用所有已开放入口", "保存账号下的历史会话"],
    highlighted: false,
  },
  {
    id: "plus",
    name: "Plus",
    priceLabel: "¥19 / 月",
    description: "适合日常学习和稳定使用。",
    monthlyMessageLimit: 500,
    benefits: ["每月 500 次 AI 对话", "包含 Free 的全部权益", "适合复习助手和多场景连续使用"],
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    priceLabel: "¥49 / 月",
    description: "适合重度用户和小团队预留。",
    monthlyMessageLimit: 2000,
    benefits: ["每月 2000 次 AI 对话", "包含 Plus 的全部权益", "适合高频对话和密集复习周期"],
    highlighted: true,
  },
] as const;

export type MembershipTierId = (typeof MEMBERSHIP_TIERS)[number]["id"];

export type MembershipSummary = {
  tierId: MembershipTierId;
  name: string;
  monthlyMessageLimit: number;
  monthlyMessagesUsed: number;
  monthlyMessagesRemaining: number;
  periodLabel: string;
  expiresAt: string | null;
};

export function parseMembershipTierId(value: unknown): MembershipTierId {
  return MEMBERSHIP_TIERS.some((tier) => tier.id === value) ? (value as MembershipTierId) : DEFAULT_MEMBERSHIP_TIER_ID;
}

export function getMembershipTier(value: unknown) {
  const tierId = parseMembershipTierId(value);
  return MEMBERSHIP_TIERS.find((tier) => tier.id === tierId) ?? MEMBERSHIP_TIERS[0];
}

export function getEffectiveMembershipTier(value: unknown, expiresAt: unknown, now = new Date()) {
  const tier = getMembershipTier(value);

  if (tier.id === DEFAULT_MEMBERSHIP_TIER_ID) {
    return tier;
  }

  if (typeof expiresAt !== "string") {
    return getMembershipTier(DEFAULT_MEMBERSHIP_TIER_ID);
  }

  const expiresAtTime = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtTime) || expiresAtTime <= now.getTime()) {
    return getMembershipTier(DEFAULT_MEMBERSHIP_TIER_ID);
  }

  return tier;
}

export function getMembershipUsagePeriod(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    month: "2-digit",
    timeZone: "Asia/Shanghai",
    year: "numeric",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "1970";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";

  return { usageDate: `${year}-${month}-01`, label: `${year}-${month}` };
}
