import type { ChatMessage } from "../../../core/types.js";
import type { GenerateInitialOutlineInput } from "../types.js";

export function buildGenerateInitialOutlineMessages(input: GenerateInitialOutlineInput): ChatMessage[] {
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
        `用户规划卷数：${input.volumeCount}`,
        `世界背景：${input.setting.background}`,
        `世界规则：${input.setting.worldRules.join("；")}`,
        `角色：${input.setting.characterSeeds.map((item) => `${item.name}(${item.role})`).join("；")}`,
        "",
        "生成全书完整故事脉络，以及每一卷的详细规划。",
        `volumes 必须恰好包含 ${input.volumeCount} 卷，不能根据目标字数增加或减少卷数。`,
        "每卷必须详细说明：该卷目标、核心冲突、主要阶段、关键转折、角色关系变化、力量体系推进、真相揭示进度、卷末结果和对下一卷的推动。",
        "不要生成章纲、章节编号、章节范围或任何 chapter 级内容。",
        "输出字段：novelId、masterOutline、volumes、timelineEvents、foreshadowing、issues、status。",
        "masterOutline 必须包含 opening、mainGoal、escalation、climax、ending、protagonistArc。",
        "volumes 每项包含 id、title、goal、conflict、highlights、stages、characterDevelopment、powerSystemProgression、revelations、endingOutcome、nextVolumeHook、status。",
        "stages 至少列出该卷的开局、发展、重大转折、高潮和收束；characterDevelopment 描述主要人物和关系变化；revelations 描述本卷揭开的真相及仍保留的谜团。",
      ].join("\n"),
    },
  ];
}
