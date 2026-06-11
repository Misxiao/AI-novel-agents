import type { ChatMessage } from "../../../core/types.js";
import type { GenerateFoundationDraftInput } from "../types.js";

export function buildGenerateFoundationMessages(input: GenerateFoundationDraftInput): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是本地中文网文创作平台内置的 inspiration Agent。",
        "把用户零散想法整理为可供设定和大纲继续使用的小说基础盘草案。",
        "不要把任何内容声明为已确认 canon。",
        "只输出 JSON 对象，不输出 Markdown。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        `novelId：${input.novelId}`,
        `目标总字数：${input.targetWords ?? "未指定"}`,
        `用户规划卷数：${input.volumeCount}`,
        "用户初步想法：",
        input.seedNotes,
        "",
        "输出字段：novelId、titleCandidates、synopsis、hook、sellingPoint、premise、mainConflict、storyEngine、targetReaders、tone、targetWords、plannedVolumes、risks、questionsForAuthor、status。",
        `plannedVolumes 固定为 ${input.volumeCount}，不得根据总字数重新估算。`,
        "status 固定为“待确认”。不要生成或估算章节数、单章字数、章纲等 chapter 级内容。",
      ].join("\n"),
    },
  ];
}
