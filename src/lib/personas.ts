export const APP_IDS = ["mamanshuo", "celebrities", "study"] as const;

export type AppId = (typeof APP_IDS)[number];

export type PersonaId =
  | "maman"
  | "study-helper"
  | "zhang-yiming"
  | "zhangxuefeng"
  | "feynman"
  | "munger"
  | "steve-jobs"
  | "elon-musk"
  | "paul-graham"
  | "naval"
  | "taleb"
  | "karpathy"
  | "ilya"
  | "mrbeast"
  | "sun-yuchen"
  | "trump";

export type PublicPersona = {
  id: PersonaId;
  appId: AppId;
  name: string;
  description: string;
  suitableFor: string;
  source: string;
};

const NUWA_SOURCE = "基于 Nuwa 已蒸馏人物 skill 的公开资料框架整理";

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
    id: "study-helper",
    appId: "study",
    name: "复习助手",
    description: "帮你把课件整理成重点、考点、提纲和自测题。",
    suitableFor: "课件总结、考点提炼、章节复习、自测题生成",
    source: "项目内置学习助教提示词",
  },
  {
    id: "zhang-yiming",
    appId: "celebrities",
    name: "张一鸣",
    description: "用产品、组织和长期主义视角拆解问题。",
    suitableFor: "产品判断、组织选择、长期决策、信息效率",
    source: NUWA_SOURCE,
  },
  {
    id: "zhangxuefeng",
    appId: "celebrities",
    name: "张雪峰",
    description: "用就业、专业回报和现实约束分析选择。",
    suitableFor: "专业选择、升学规划、家庭资源约束、就业路径",
    source: NUWA_SOURCE,
  },
  {
    id: "feynman",
    appId: "celebrities",
    name: "费曼",
    description: "用第一性原理和清楚解释拆掉复杂问题。",
    suitableFor: "学习理解、科学解释、概念澄清、识别伪懂",
    source: NUWA_SOURCE,
  },
  {
    id: "munger",
    appId: "celebrities",
    name: "芒格",
    description: "用多元模型、逆向思考和激励机制审视判断。",
    suitableFor: "投资判断、风险识别、商业决策、认知偏差",
    source: NUWA_SOURCE,
  },
  {
    id: "steve-jobs",
    appId: "celebrities",
    name: "乔布斯",
    description: "用聚焦、品味和端到端体验审视产品。",
    suitableFor: "产品取舍、体验设计、品牌表达、团队标准",
    source: NUWA_SOURCE,
  },
  {
    id: "elon-musk",
    appId: "celebrities",
    name: "马斯克",
    description: "用物理约束、成本结构和快速迭代挑战默认假设。",
    suitableFor: "工程路线、成本拆解、硬科技项目、激进目标",
    source: NUWA_SOURCE,
  },
  {
    id: "paul-graham",
    appId: "celebrities",
    name: "Paul Graham",
    description: "用创业、写作和独立思考重构问题。",
    suitableFor: "创业方向、产品早期验证、写作表达、职业选择",
    source: NUWA_SOURCE,
  },
  {
    id: "naval",
    appId: "celebrities",
    name: "Naval",
    description: "用杠杆、特定知识和长期自由衡量选择。",
    suitableFor: "职业杠杆、个人商业、财富观、欲望管理",
    source: NUWA_SOURCE,
  },
  {
    id: "taleb",
    appId: "celebrities",
    name: "塔勒布",
    description: "用尾部风险、反脆弱和皮肤在场挑战叙事。",
    suitableFor: "风险评估、黑天鹅、反脆弱策略、专家共识审视",
    source: NUWA_SOURCE,
  },
  {
    id: "karpathy",
    appId: "celebrities",
    name: "Karpathy",
    description: "用工程现实主义看 AI、学习和软件范式。",
    suitableFor: "AI 产品可靠性、学习路径、LLM 边界、技术趋势",
    source: NUWA_SOURCE,
  },
  {
    id: "ilya",
    appId: "celebrities",
    name: "Ilya",
    description: "用压缩、规模和安全能力纠缠看 AI 方向。",
    suitableFor: "AI 研究方向、安全策略、模型能力判断、长期趋势",
    source: NUWA_SOURCE,
  },
  {
    id: "mrbeast",
    appId: "celebrities",
    name: "MrBeast",
    description: "用点击、留存和极致执行拆内容创作。",
    suitableFor: "视频选题、标题封面、留存曲线、内容增长",
    source: NUWA_SOURCE,
  },
  {
    id: "sun-yuchen",
    appId: "celebrities",
    name: "孙宇晨",
    description: "用注意力套利、叙事覆盖和身份杠杆看传播。",
    suitableFor: "加密行业传播、热点借势、公关叙事、注意力策略",
    source: `${NUWA_SOURCE}；争议人物，仅作公开思维框架分析`,
  },
  {
    id: "trump",
    appId: "celebrities",
    name: "特朗普",
    description: "用交易、媒体叙事和谈判筹码分析公共表达。",
    suitableFor: "谈判策略、传播叙事、权力博弈、公开行为分析",
    source: `${NUWA_SOURCE}；争议人物，仅作公开思维框架分析`,
  },
];

const DEFAULT_PERSONA_BY_APP: Record<AppId, PersonaId> = {
  mamanshuo: "maman",
  celebrities: "zhang-yiming",
  study: "study-helper",
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
