import type { AppId, PersonaId } from "./personas";

export type PromptSuggestion = {
  label: string;
  prompt: string;
};

export const MAMANSHUO_PROMPTS: PromptSuggestion[] = [
  { label: "有点累", prompt: "我有点累，但又说不清楚哪里累。请陪我慢慢梳理一下。" },
  { label: "压力很大", prompt: "我最近压力很大，有点喘不过气。请陪我把这些压力一件件理出来。" },
  { label: "有些焦虑", prompt: "我最近有些焦虑，脑子里一直停不下来。请陪我把这些想法慢慢理清楚。" },
  { label: "聊聊关系", prompt: "我想聊聊一段关系里的困扰，请先听我说，再帮我整理感受。" },
  { label: "复盘今天", prompt: "陪我复盘一下今天发生的事，帮我看见哪些地方已经尽力了。" },
];

const CELEBRITY_PROMPTS: Partial<Record<PersonaId, PromptSuggestion[]>> = {
  "zhang-yiming": [
    {
      label: "如何判断产品方向？",
      prompt: "我有一个产品方向，想请你从用户价值、长期趋势和执行路径帮我判断是否值得做。",
    },
    { label: "怎么提高信息效率？", prompt: "我最近信息很乱，请帮我从信息效率和长期目标的角度整理一套判断方法。" },
    { label: "这个选择长期看好吗？", prompt: "我正在做一个选择，请帮我从长期主义和机会成本角度拆解。" },
    { label: "团队该怎么取舍？", prompt: "我想做一个团队或项目取舍，请帮我看关键约束和优先级。" },
  ],
  zhangxuefeng: [
    { label: "专业怎么选？", prompt: "我该怎么选专业？请从就业、现实约束和长期发展帮我拆解。" },
    { label: "考研还是就业？", prompt: "我在纠结考研还是就业，请从家庭资源、专业回报和风险角度分析。" },
    { label: "这个学校值不值？", prompt: "我想判断一个学校或专业值不值得去，请帮我列出关键判断维度。" },
    { label: "怎么和家里沟通？", prompt: "我和家里在升学或就业选择上有分歧，请帮我准备一套沟通思路。" },
  ],
  feynman: [
    { label: "我没学懂", prompt: "我有个概念一直没学懂，请用费曼式解释帮我拆到足够简单。" },
    { label: "帮我找卡点", prompt: "我在学习一个主题时卡住了，请帮我找出我可能没真正理解的地方。" },
    { label: "怎么讲给别人听？", prompt: "我需要把一个复杂概念讲给别人听，请帮我组织成清楚的解释。" },
  ],
  munger: [
    { label: "这个决定风险在哪？", prompt: "我正在做一个重要决定，请帮我用逆向思维找出最容易忽略的风险。" },
    { label: "我是不是有偏见？", prompt: "我担心自己的判断有认知偏差，请用多元模型帮我检查。" },
    { label: "这个机会值得吗？", prompt: "我遇到一个机会，请帮我从激励机制、机会成本和下行风险分析。" },
  ],
};

const DEFAULT_CELEBRITY_PROMPTS = CELEBRITY_PROMPTS["zhang-yiming"] ?? [];

export function getPromptSuggestions(appId: AppId, personaId: PersonaId) {
  if (appId === "mamanshuo") {
    return MAMANSHUO_PROMPTS;
  }

  return CELEBRITY_PROMPTS[personaId] ?? DEFAULT_CELEBRITY_PROMPTS;
}
