import type { AgentDefinition } from "../../core/types.js";

export const chapterAgentDefinition: AgentDefinition = {
  id: "chapter",
  name: "章节 Agent",
  role: "负责章节正文生产、修订和局部编辑，输出待确认正文，不直接写入 canon。",
  capabilities: [
    "chapter.planChapterDraft",
    "chapter.writeNextChapter",
    "chapter.reviseChapter",
    "chapter.rewriteScene",
    "chapter.expandText",
    "chapter.compressText",
    "chapter.polishStyle",
  ],
};
