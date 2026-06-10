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
        "用户初步想法：",
        input.seedNotes,
        "",
        "输出字段：novelId、titleCandidates、synopsis、hook、sellingPoint、premise、mainConflict、storyEngine、targetReaders、tone、targetWords、estimatedChapters、estimatedVolumes、chapterWordTarget、risks、questionsForAuthor、status。",
        "status 固定为“待确认”。章节目标字数默认约 3000，并据此估算章节数；卷数应与总字数匹配。",
      ].join("\n"),
    },
  ];
}
