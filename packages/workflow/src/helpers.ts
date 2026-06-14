import type {
  ChapterDraft,
  ChapterStore,
  ConsistencyReport,
  DraftReview,
  MainOutline,
  Store,
} from "@ai-novel-agents/store";

/** 由总纲的 estimatedChapters 累加出每卷的章节区间 */
export function volumeChapterRanges(
  mainOutline: MainOutline,
): Map<number, { from: number; to: number }> {
  const ranges = new Map<number, { from: number; to: number }>();
  let cursor = 1;
  for (const volume of mainOutline.volumes) {
    const to = cursor + Math.max(volume.estimatedChapters, 1) - 1;
    ranges.set(volume.volumeNo, { from: cursor, to });
    cursor = to + 1;
  }
  return ranges;
}

/** 优先用已确认卷纲的章节区间，回落到总纲累加区间 */
export function resolveVolumeRange(
  store: Store,
  novelId: string,
  volumeNo: number,
): { from: number; to: number } | undefined {
  const volumeOutline = store.outlines.getActiveVolume(novelId, volumeNo);
  if (volumeOutline) {
    return volumeOutline.content.chapterRange;
  }
  const main = store.outlines.getActiveMain(novelId);
  return main ? volumeChapterRanges(main.content).get(volumeNo) : undefined;
}

const REVISION_THRESHOLD = 7.5;

/** 一致性有 blocker 或评分低于阈值则需要修订 */
export function needsRevision(review: DraftReview, threshold = REVISION_THRESHOLD): boolean {
  const hasBlocker = review.consistency?.violations.some((v) => v.severity === "blocker") ?? false;
  return hasBlocker || review.score < threshold;
}

/** 把评审意见与一致性违规整理成给 writer 的修订指令 */
export function buildRevisionDirectives(review: DraftReview): string[] {
  const directives = [...review.revisionInstructions];
  for (const violation of review.consistency?.violations ?? []) {
    if (violation.severity === "blocker") {
      directives.push(
        `【必须修复·${violation.layer}】${violation.detail}${violation.suggestion ? `——${violation.suggestion}` : ""}`,
      );
    }
  }
  return directives;
}

/** 选出最佳草稿：优先一致性通过且评分最高，回落评分最高，再回落最新 */
export function selectBestDraft(chapters: ChapterStore, chapterId: string): ChapterDraft {
  const drafts = chapters.listDrafts(chapterId);
  if (drafts.length === 0) {
    throw new Error(`章节 ${chapterId} 还没有任何草稿`);
  }

  const scored = drafts.filter((draft) => draft.review);
  if (scored.length === 0) {
    return drafts[drafts.length - 1];
  }

  return [...scored].sort((a, b) => rank(b) - rank(a))[0];
}

function rank(draft: ChapterDraft): number {
  const review = draft.review!;
  const passes = review.consistency?.violations.every((v) => v.severity !== "blocker") ?? true;
  // 一致性通过加 100，确保压过任何评分差异
  return (passes ? 100 : 0) + review.score;
}

export function consistencyBlockers(report: ConsistencyReport | undefined): string[] {
  return (report?.violations ?? [])
    .filter((v) => v.severity === "blocker")
    .map((v) => `${v.layer}：${v.detail}`);
}
