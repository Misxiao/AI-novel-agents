import {
  confirmChapterWorkflow,
  consistencyBlockers,
  selectBestDraft,
} from "@ai-novel-agents/workflow";

import { confirm, p } from "../clack.js";
import type { AppContext } from "../context.js";
import { formatConsistency, formatMemory, previewDraft } from "../display.js";
import { runWf } from "../runner.js";
import { section } from "../render/section.js";
import { color } from "../util.js";

/** 确认章节：展示待确认稿 → 一致性门禁 → 提取记忆落库 */
export async function confirmChapterWizard(ctx: AppContext, chapterNo: number): Promise<void> {
  const novelId = ctx.currentNovelId;
  const chapter = ctx.store.chapters.get(novelId, chapterNo);
  if (!chapter) {
    p.log.warn(`第 ${chapterNo} 章还不存在`);
    return;
  }

  const draft = selectBestDraft(ctx.store.chapters, chapter.id);
  section(`第 ${chapterNo} 章 · 待确认稿`, previewDraft(draft));
  if (draft.review?.consistency) {
    p.log.message(formatConsistency(draft.review.consistency));
  }

  const blockers = consistencyBlockers(draft.review?.consistency);
  if (blockers.length > 0) {
    p.log.warn(color.red("一致性审查未通过，建议先修订："));
    for (const blocker of blockers) {
      p.log.message(`  · ${blocker}`);
    }
    if (!(await confirm("仍要强行确认吗？（不推荐）", false))) {
      return;
    }
    // 强行确认前，临时把阻断降级，使门禁放行
    draft.review!.consistency!.violations = draft.review!.consistency!.violations.map((v) => ({
      ...v,
      severity: "warning" as const,
    }));
    draft.review!.consistency!.pass = true;
    ctx.store.chapters.setDraftReview(draft.id, draft.review!);
  } else if (!(await confirm(`确认第 ${chapterNo} 章并写入记忆台账？`))) {
    return;
  }

  const result = await runWf(ctx, confirmChapterWorkflow, { novelId, chapterNo, draftId: draft.id });
  if (result.status !== "completed") {
    return;
  }

  const memory = result.outputs["extract"] as Parameters<typeof formatMemory>[0] | undefined;
  if (memory) {
    section(`第 ${chapterNo} 章 · 已写入记忆`, formatMemory(memory));
  }
  const rollup = result.outputs["rollup"] as { actions: string[] } | undefined;
  if (rollup && rollup.actions.length > 0) {
    p.log.success(rollup.actions.join("；"));
  }
}
