import type { AgentDefinition } from "../../core/types.js";

export const planAgentDefinition: AgentDefinition = {
  id: "plan",
  name: "章节规划 Agent",
  role: "负责生成单章章纲草案和章节写作执行计划，不直接写正文，不写入 canon。",
  capabilities: [
    "plan.createChapterPlan",
    "plan.createChapterDraftPlan",
  ],
};

