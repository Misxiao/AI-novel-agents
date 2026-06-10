import type { AgentDefinition } from "../../core/types.js";

export const inspirationAgentDefinition: AgentDefinition = {
  id: "inspiration",
  name: "灵感 Agent",
  role: "把零散创作想法整理成小说基础盘草案，不写入 canon。",
  capabilities: ["inspiration.generateFoundationDraft"],
};
