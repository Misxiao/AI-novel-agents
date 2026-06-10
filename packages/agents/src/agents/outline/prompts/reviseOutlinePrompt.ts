import type { ChatMessage } from "../../../core/types.js";
import type {
  ReviseMasterOutlineInput,
  ReviseVolumeOutlineInput,
} from "../types.js";

export function buildReviseMasterOutlineMessages(
  input: ReviseMasterOutlineInput,
): ChatMessage[] {
  return buildMessages("master", input);
}

export function buildReviseVolumeOutlineMessages(
  input: ReviseVolumeOutlineInput,
): ChatMessage[] {
  return buildMessages("volume", input);
}

function buildMessages(
  scope: "master" | "volume",
  input: ReviseMasterOutlineInput | ReviseVolumeOutlineInput,
): ChatMessage[] {
  const targetVolumeId = scope === "volume"
    ? (input as ReviseVolumeOutlineInput).volumeId
    : "";
  return [
    {
      role: "system",
      content: [
        "你是本地中文网文创作平台内置的 outline Agent。",
        "根据自然语言指令修改已有大纲，并返回完整候选大纲和结构化影响分析。",
        "候选结果仍是待确认草案，不写正文、不确认资产、不写入 canon。",
        scope === "volume"
          ? "本次只能修改目标卷、目标卷未确认章纲及其明确绑定的时间线和伏笔；不得修改总纲、其他卷内容或已确认章节。"
          : "本次允许修改总纲，并按影响范围新增、删除、拆分或合并分卷及未确认章纲。",
        "保留未受影响资产的稳定 ID。新资产必须生成新 ID。",
        "只输出 JSON 对象，不输出 Markdown。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `novelId：${input.novelId}`,
        `修改范围：${scope}`,
        targetVolumeId ? `目标 volumeId：${targetVolumeId}` : "",
        `修改指令：${input.instruction}`,
        `受保护章纲：${JSON.stringify(input.protectedChapterPlans)}`,
        `基础盘：${JSON.stringify(input.foundation)}`,
        `设定：${JSON.stringify(input.setting)}`,
        `源大纲：${JSON.stringify(input.sourceOutline)}`,
        "",
        "输出字段：revisedOutline、diffSummary、impactAnalysis、chapterNumberChanges。",
        "revisedOutline 必须是完整大纲，包含 novelId、masterOutline、volumes、chapterPlans、timelineEvents、foreshadowing、issues、status。",
        "impactAnalysis 包含 affectedVolumeIds、affectedChapterPlanIds、affectedTimelineEventIds、affectedForeshadowingIds、structuralChanges、conflicts、idMappings。",
        "conflicts 每项包含 id、severity(info|warning|critical)、category、description、suggestion。",
        "idMappings 每项包含 kind(volume|chapter)、sourceIds、targetIds，用于拆分、合并和替换追踪。",
        "chapterNumberChanges 每项包含 chapterPlanId、from、to；最终编号还会由 Workflow 做确定性校验。",
      ].filter(Boolean).join("\n"),
    },
  ];
}
