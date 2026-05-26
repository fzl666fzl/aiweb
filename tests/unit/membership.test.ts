import { describe, expect, it } from "vitest";
import {
  DEFAULT_MEMBERSHIP_TIER_ID,
  getEffectiveMembershipTier,
  getMembershipTier,
  getMembershipUsagePeriod,
  parseMembershipTierId,
} from "@/lib/membership";

describe("membership policy", () => {
  it("defaults unknown tiers to Free", () => {
    expect(parseMembershipTierId("enterprise")).toBe(DEFAULT_MEMBERSHIP_TIER_ID);
    expect(getMembershipTier("enterprise").monthlyMessageLimit).toBe(50);
  });

  it("defines different monthly message limits for Free, Plus, and Pro", () => {
    expect(getMembershipTier("free").monthlyMessageLimit).toBe(50);
    expect(getMembershipTier("plus").monthlyMessageLimit).toBe(500);
    expect(getMembershipTier("pro").monthlyMessageLimit).toBe(2000);
  });

  it("uses the Asia/Shanghai month start as the usage bucket", () => {
    expect(getMembershipUsagePeriod(new Date("2026-05-31T16:30:00.000Z")).usageDate).toBe("2026-06-01");
  });

  it("keeps paid tiers active before expiration", () => {
    expect(
      getEffectiveMembershipTier("pro", "2026-06-30T00:00:00.000Z", new Date("2026-06-01T00:00:00.000Z")).id,
    ).toBe("pro");
  });

  it("falls back to Free after membership expiration", () => {
    expect(
      getEffectiveMembershipTier("plus", "2026-05-01T00:00:00.000Z", new Date("2026-06-01T00:00:00.000Z")).id,
    ).toBe("free");
  });
});
