import type { AgentDefinition } from "../../core/types.js";

export const reviewAgentDefinition: AgentDefinition = {
  id: "review",
  name: "评审 Agent",
  role: "负责章节、大纲、一致性和风格评审，输出结构化问题，不直接修改正文或写入 canon。",
  capabilities: ["review.reviewChapter"],
};
