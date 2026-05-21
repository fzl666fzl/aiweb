import { describe, expect, it } from "vitest";
import { getDefaultPersonaId, getPersonasForApp, isAppId, isPersonaForApp } from "@/lib/personas";

describe("persona registry", () => {
  it("returns the default 慢慢说 persona", () => {
    expect(getDefaultPersonaId("mamanshuo")).toBe("maman");
    expect(isPersonaForApp("maman", "mamanshuo")).toBe(true);
  });

  it("returns the built-in celebrity advisors", () => {
    const celebrities = getPersonasForApp("celebrities");

    expect(getDefaultPersonaId("celebrities")).toBe("zhang-yiming");
    expect(celebrities.map((persona) => persona.id)).toEqual([
      "zhang-yiming",
      "zhangxuefeng",
      "feynman",
      "munger",
      "steve-jobs",
      "elon-musk",
      "paul-graham",
      "naval",
      "taleb",
      "karpathy",
      "ilya",
      "mrbeast",
      "sun-yuchen",
      "trump",
    ]);
  });

  it("rejects unknown apps and cross-app personas", () => {
    expect(isAppId("unknown")).toBe(false);
    expect(isPersonaForApp("maman", "celebrities")).toBe(false);
    expect(isPersonaForApp("zhang-yiming", "mamanshuo")).toBe(false);
  });
});
