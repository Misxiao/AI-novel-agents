import type { ChatMessage } from "../../../core/types.js";
import type { GenerateInitialOutlineInput } from "../types.js";

export function buildGenerateInitialOutlineMessages(input: GenerateInitialOutlineInput): ChatMessage[] {
  const chapterPlanCount = Math.min(20, Math.max(10, Math.floor(input.chapterPlanCount ?? 12)));
  return [
    {
      role: "system",
      content: [
        "你是本地中文网文创作平台内置的 outline Agent。",
        "根据基础盘和设定草案生成可供章节生产使用的初始大纲草案。",
        "不要把草案声明为已确认，不写正文，不写入 canon。",
        "只输出 JSON 对象，不输出 Markdown。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `novelId：${input.novelId}`,
        `故事简介：${input.foundation.synopsis}`,
        `主冲突：${input.foundation.mainConflict}`,
        `故事引擎：${input.foundation.storyEngine}`,
        `目标字数：${input.foundation.targetWords}`,
        `预计卷数：${input.foundation.estimatedVolumes}`,
        `世界背景：${input.setting.background}`,
        `世界规则：${input.setting.worldRules.join("；")}`,
        `角色：${input.setting.characterSeeds.map((item) => `${item.name}(${item.role})`).join("；")}`,
        "",
        `生成全书粗总纲、所有卷的粗卷纲，以及前 ${chapterPlanCount} 章章纲。`,
        "输出字段：novelId、masterOutline、volumes、chapterPlans、timelineEvents、foreshadowing、issues、status。",
        "chapterPlans 每项必须包含 id、novelId、chapterNo、title、volumeId、volumeTitle、objective、hook、status；status 固定为“待确认”。",
      ].join("\n"),
    },
  ];
}
