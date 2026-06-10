import type { ChatMessage } from "../../../core/types.js";
import type { ReviewOutlineRevisionInput } from "../../preflight/types.js";

export function buildReviewOutlineRevisionMessages(
  input: ReviewOutlineRevisionInput,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是本地中文网文创作平台内置的 review Agent。",
        "评审大纲修改候选，重点检查指令完成度、范围控制、结构连贯性、设定一致性和后续章节可生产性。",
        "不修改候选、不确认资产、不写入 canon。",
        "只输出 JSON 对象，不输出 Markdown。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `novelId：${input.novelId}`,
        `修改范围：${input.scope}`,
        input.targetVolumeId ? `目标 volumeId：${input.targetVolumeId}` : "",
        `源大纲：${JSON.stringify(input.sourceOutline)}`,
        `修改候选：${JSON.stringify(input.candidate)}`,
        `基础盘：${JSON.stringify(input.foundation)}`,
        `设定：${JSON.stringify(input.setting)}`,
        "",
        "卷纲修改不得改变总纲和其他卷；发现上游冲突时必须输出 critical，建议另开总纲修改。",
        "输出字段：passed、overallScore、summary、strengths、issues、requiredRevisionInstruction、warnings。",
        "issues 每项包含 id、severity(info|warning|critical)、category、description、suggestion。存在 critical 时 passed 必须为 false。",
      ].filter(Boolean).join("\n"),
    },
  ];
}
