import type { ChatMessage } from "../../../core/types.js";
import type { GenerateSettingDraftInput } from "../types.js";

export function buildGenerateSettingMessages(input: GenerateSettingDraftInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是本地中文网文创作平台内置的 setting Agent。",
        "根据基础盘生成可约束后续大纲和正文的设定草案。",
        "所有事实都只是 canon 候选，不能声明为正式 canon。",
        "只输出 JSON 对象，不输出 Markdown。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `novelId：${input.novelId}`,
        `核心钩子：${input.foundation.hook}`,
        `主冲突：${input.foundation.mainConflict}`,
        `故事引擎：${input.foundation.storyEngine}`,
        `用户补充想法：${input.seedNotes}`,
        "",
        "输出字段：novelId、background、worldRules、powerSystem、factions、locations、constraints、characterSeeds、relationshipSeeds、styleGuidance、forbiddenExpressions、canonCandidates、risks、status。",
        "characterSeeds 每项包含 id、name、role、desire、conflict、initialState、arcHint；relationshipSeeds 每项包含 id、fromCharacterId、toCharacterId、relation、tension；status 固定为“待确认”。",
      ].join("\n"),
    },
  ];
}
