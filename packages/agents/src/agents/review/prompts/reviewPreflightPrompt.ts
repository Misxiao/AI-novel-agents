import type { ChatMessage } from "../../../core/types.js";
import type {
  PreflightAssetKind,
  ReviewFoundationInput,
  ReviewOutlineInput,
  ReviewSettingInput,
} from "../../preflight/types.js";

export type PreflightReviewInput =
  | ReviewFoundationInput
  | ReviewSettingInput
  | ReviewOutlineInput;

export function buildReviewPreflightMessages(
  kind: PreflightAssetKind,
  input: PreflightReviewInput,
): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是本地中文网文创作平台内置的 review Agent。",
        "评审小说前置资产草案，输出结构化风险和修订建议。",
        "你不修改草案，不确认资产，不写入 canon。",
        "只输出 JSON 对象，不输出 Markdown。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `novelId：${input.novelId}`,
        `资产类型：${kind}`,
        "待评审内容：",
        JSON.stringify(input),
        "",
        "基础盘重点检查：卖点是否明确、主冲突是否可持续、故事引擎能否支撑长篇发展、规模是否匹配。",
        "设定重点检查：世界规则是否互相冲突、能力是否有代价、人物目标与关系张力是否足够。",
        "大纲重点检查：全书脉络与卷纲是否一致、每卷内容是否足够详细、卷间升级是否连续、角色弧光和力量体系是否推进、伏笔与时间线是否可维护。不要评审章纲或章节内容。",
        "输出字段：passed、overallScore、summary、strengths、issues、requiredRevisionInstruction、warnings。",
        "issues 每项包含 id、severity(info|warning|critical)、category、description、suggestion。存在 critical 时 passed 必须为 false。",
      ].join("\n"),
    },
  ];
}
