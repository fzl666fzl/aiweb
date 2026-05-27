import type { MembershipTierId } from "./membership";

export type ChatQualityPolicy = {
  experiencePrompt: string;
  historyMessageLimit: number;
  studyContextCharLimit: number;
  studyContextChunkLimit: number;
  studyHistoryMessageLimit: number;
};

const POLICIES: Record<MembershipTierId, ChatQualityPolicy> = {
  free: {
    experiencePrompt: "当前用户是 Free 档位。回答保持清楚、简洁、够用，不刻意拉长。",
    historyMessageLimit: 12,
    studyContextCharLimit: 8000,
    studyContextChunkLimit: 5,
    studyHistoryMessageLimit: 4,
  },
  plus: {
    experiencePrompt:
      "当前用户是 Plus 会员。回答可以更完整一些：优先给清晰步骤、必要例子和简短总结，帮助用户稳定推进。",
    historyMessageLimit: 48,
    studyContextCharLimit: 24000,
    studyContextChunkLimit: 10,
    studyHistoryMessageLimit: 12,
  },
  pro: {
    experiencePrompt:
      "当前用户是 Pro 会员。回答可以更深入、更有结构；适合长任务、长复习和多轮项目讨论，主动保留前文目标、约束和关键细节。",
    historyMessageLimit: 96,
    studyContextCharLimit: 50000,
    studyContextChunkLimit: 18,
    studyHistoryMessageLimit: 20,
  },
};

export function getChatQualityPolicy(tierId: MembershipTierId): ChatQualityPolicy {
  return POLICIES[tierId] ?? POLICIES.free;
}
