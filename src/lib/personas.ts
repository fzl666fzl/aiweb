export const APP_IDS = ["mamanshuo", "celebrities"] as const;

export type AppId = (typeof APP_IDS)[number];

export type PersonaId = "maman" | "zhang-yiming" | "zhangxuefeng" | "feynman" | "munger";

export type PublicPersona = {
  id: PersonaId;
  appId: AppId;
  name: string;
  description: string;
  suitableFor: string;
  source: string;
};

const PERSONAS: PublicPersona[] = [
  {
    id: "maman",
    appId: "mamanshuo",
    name: "慢慢说",
    description: "温和、克制地陪你把此刻说清楚一点。",
    suitableFor: "情绪倾诉、压力整理、关系困扰、日常复盘",
    source: "项目内置陪伴提示词",
  },
  {
    id: "zhang-yiming",
    appId: "celebrities",
    name: "张一鸣",
    description: "用产品、组织和长期主义视角拆解问题。",
    suitableFor: "产品判断、组织选择、长期决策、信息效率",
    source: "基于 Nuwa 已蒸馏人物 skill 的公开资料框架整理",
  },
  {
    id: "zhangxuefeng",
    appId: "celebrities",
    name: "张雪峰",
    description: "用就业、专业回报和现实约束来分析选择。",
    suitableFor: "专业选择、升学规划、家庭资源约束、就业路径",
    source: "基于 Nuwa 已蒸馏人物 skill 的公开资料框架整理",
  },
  {
    id: "feynman",
    appId: "celebrities",
    name: "费曼",
    description: "用第一性原理和清楚解释来拆掉复杂问题。",
    suitableFor: "学习理解、科学解释、概念澄清、识别伪懂",
    source: "基于 Nuwa 已蒸馏人物 skill 的公开资料框架整理",
  },
  {
    id: "munger",
    appId: "celebrities",
    name: "芒格",
    description: "用多元模型、逆向思考和激励机制审视判断。",
    suitableFor: "投资判断、风险识别、商业决策、认知偏差",
    source: "基于 Nuwa 已蒸馏人物 skill 的公开资料框架整理",
  },
];

const DEFAULT_PERSONA_BY_APP: Record<AppId, PersonaId> = {
  mamanshuo: "maman",
  celebrities: "zhang-yiming",
};

export function isAppId(value: unknown): value is AppId {
  return typeof value === "string" && APP_IDS.includes(value as AppId);
}

export function getDefaultPersonaId(appId: AppId) {
  return DEFAULT_PERSONA_BY_APP[appId];
}

export function getPersonasForApp(appId: AppId) {
  return PERSONAS.filter((persona) => persona.appId === appId);
}

export function getPersona(personaId: PersonaId) {
  return PERSONAS.find((persona) => persona.id === personaId);
}

export function isPersonaForApp(personaId: unknown, appId: AppId): personaId is PersonaId {
  return typeof personaId === "string" && PERSONAS.some((persona) => persona.id === personaId && persona.appId === appId);
}

export function parseAppId(value: unknown): AppId | null {
  return isAppId(value) ? value : null;
}

export function parsePersonaId(value: unknown, appId: AppId): PersonaId | null {
  return isPersonaForApp(value, appId) ? value : null;
}
