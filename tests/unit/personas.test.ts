import { describe, expect, it } from "vitest";
import { getSystemPrompt } from "@/lib/persona-prompts";
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

  it("recognizes the study app and its default helper persona", () => {
    expect(isAppId("study")).toBe(true);
    expect(getDefaultPersonaId("study")).toBe("study-helper");
    expect(isPersonaForApp("study-helper", "study")).toBe(true);
    expect(getPersonasForApp("study")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "study-helper",
          appId: "study",
          name: "复习助手",
        }),
      ]),
    );
  });

  it("keeps the study helper focused on concise staged summaries", () => {
    const prompt = getSystemPrompt("study-helper");

    expect(prompt).toContain("默认先给短版");
    expect(prompt).toContain("600-900 字");
    expect(prompt).toContain("先输出最可用的重点");
    expect(prompt).toContain("分阶段整理");
  });

  it("rejects unknown apps and cross-app personas", () => {
    expect(isAppId("unknown")).toBe(false);
    expect(isPersonaForApp("maman", "celebrities")).toBe(false);
    expect(isPersonaForApp("zhang-yiming", "mamanshuo")).toBe(false);
  });
});
