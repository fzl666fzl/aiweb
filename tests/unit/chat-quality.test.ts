import { describe, expect, it } from "vitest";
import { getChatQualityPolicy } from "@/lib/chat-quality";

describe("chat quality policy", () => {
  it("keeps Free on the current compact context", () => {
    expect(getChatQualityPolicy("free")).toMatchObject({
      historyMessageLimit: 12,
      studyHistoryMessageLimit: 4,
      studyContextCharLimit: 8000,
      studyContextChunkLimit: 5,
    });
  });

  it("gives Plus a longer context and fuller answer guidance", () => {
    const policy = getChatQualityPolicy("plus");

    expect(policy).toMatchObject({
      historyMessageLimit: 48,
      studyHistoryMessageLimit: 12,
      studyContextCharLimit: 24000,
      studyContextChunkLimit: 10,
    });
    expect(policy.experiencePrompt).toContain("Plus");
    expect(policy.experiencePrompt).toContain("步骤");
    expect(policy.experiencePrompt).toContain("例子");
  });

  it("gives Pro the longest context and deeper answer guidance", () => {
    const policy = getChatQualityPolicy("pro");

    expect(policy).toMatchObject({
      historyMessageLimit: 96,
      studyHistoryMessageLimit: 20,
      studyContextCharLimit: 50000,
      studyContextChunkLimit: 18,
    });
    expect(policy.experiencePrompt).toContain("Pro");
    expect(policy.experiencePrompt).toContain("深入");
    expect(policy.experiencePrompt).toContain("前文");
  });
});
