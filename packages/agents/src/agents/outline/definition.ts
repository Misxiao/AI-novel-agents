import type { AgentDefinition } from "../../core/types.js";

export const outlineAgentDefinition: AgentDefinition = {
  id: "outline",
  name: "大纲 Agent",
  role: "负责总纲、卷纲、章纲、时间线和伏笔资产的生成与修改。",
  capabilities: [
    "outline.generateInitialOutline",
    "outline.reviseMasterOutline",
    "outline.reviseVolumeOutline",
  ],
};
