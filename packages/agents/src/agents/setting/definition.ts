import type { AgentDefinition } from "../../core/types.js";

export const settingAgentDefinition: AgentDefinition = {
  id: "setting",
  name: "设定 Agent",
  role: "生成和维护世界观、人物、关系及风格设定草案，不直接写入 canon。",
  capabilities: ["setting.generateSettingDraft"],
};
