import { selectBestDraft, writeChapterWorkflow } from "@ai-novel-agents/workflow";

import { text } from "../clack.js";
import type { AppContext } from "../context.js";
import { formatReview } from "../display.js";
import { runWf } from "../runner.js";
import { section } from "../render/section.js";
import { chapterWorkspace } from "./chapterWorkspace.js";

/** 写作下一章：确认意图 → 流式生成 → 展示评审 → 进入章节工作台 */
export async function writeChapterWizard(
  ctx: AppContext,
  suggestedChapterNo: number,
): Promise<void> {
  const novelId = ctx.currentNovelId;
  const due = ctx.store.foreshadows.listDue(novelId, suggestedChapterNo);
  if (due.length > 0) {
    section("本章可回收的伏笔", due.map((f) => `· ${f.title}（${f.importance}）`).join("\n"));
  }

  const authorIntent = (
    await text({
      message: `第 ${suggestedChapterNo} 章想写什么？（可留空，由 AI 按大纲推进）`,
      placeholder: "例：让林尘和苏晚正面冲突，揭一半玉佩的秘密",
    })
  ).trim();

  const result = await runWf(ctx, writeChapterWorkflow, {
    novelId,
    chapterNo: suggestedChapterNo,
    authorIntent: authorIntent || undefined,
  });
  if (result.status === "failed") {
    return;
  }

  const chapter = ctx.store.chapters.get(novelId, suggestedChapterNo)!;
  const best = selectBestDraft(ctx.store.chapters, chapter.id);
  if (best.review) {
    section(`第 ${suggestedChapterNo} 章草稿评审`, formatReview(best.review));
  }

  // 落在章节工作台：可继续查看 / 修改 / 确认
  await chapterWorkspace(ctx, suggestedChapterNo);
}
