import {
  memoryAgent,
  plan as planAgent,
  reviewer,
  searchExemplars,
  writer,
  type ExemplarType,
} from "@ai-novel-agents/agents";
import type { ChapterMemory, ChapterPlan, DraftReview } from "@ai-novel-agents/store";

import type { StepContext, WorkflowDefinition } from "./engine.js";
import {
  buildRevisionDirectives,
  consistencyBlockers,
  needsRevision,
  resolveVolumeRange,
  selectBestDraft,
} from "./helpers.js";

const GLOBAL_RECAP_LAG = 10;

// ---------- 写下一章 ----------

export interface WriteChapterInput {
  novelId: string;
  /** 不传则取下一个未写章号 */
  chapterNo?: number;
  authorIntent?: string;
  targetWords?: number;
  qualityThreshold?: number;
  maxRevisionRounds?: number;
}

interface ResolveOutput {
  chapterId: string;
  chapterNo: number;
  volumeNo: number;
}

export const writeChapterWorkflow: WorkflowDefinition<WriteChapterInput> = {
  id: "writeChapter",
  title: "写作下一章",
  inputHint: "novelId：小说 id；chapterNo：可选指定章号；authorIntent：可选作者意图",
  novelId: (input) => input.novelId,
  steps: [
    {
      id: "resolve",
      title: "定位章节",
      async run(ctx): Promise<ResolveOutput> {
        const novelId = ctx.input.novelId;
        const chapterNo = ctx.input.chapterNo ?? ctx.store.chapters.nextChapterNo(novelId);
        const bundle = ctx.store.assembleChapterContext(novelId, chapterNo);
        const chapter = ctx.store.chapters.ensure(novelId, bundle.volumeNo, chapterNo);
        return { chapterId: chapter.id, chapterNo, volumeNo: bundle.volumeNo };
      },
    },
    {
      id: "plan",
      title: "生成章纲",
      retries: 1,
      async run(ctx): Promise<ChapterPlan> {
        const { chapterId, chapterNo } = ctx.prior<ResolveOutput>("resolve");
        const existing = ctx.store.chapters.getById(chapterId);
        if (existing?.plan) {
          return existing.plan; // 已有章纲（如恢复运行），跳过 LLM
        }
        const bundle = ctx.store.assembleChapterContext(ctx.input.novelId, chapterNo);
        const plan = await planAgent.planChapter.run(
          { context: bundle, authorIntent: ctx.input.authorIntent, targetWords: ctx.input.targetWords },
          ctx.agents,
        );
        ctx.store.chapters.setPlan(chapterId, plan);
        return plan;
      },
    },
    {
      id: "write",
      title: "撰写正文",
      retries: 1,
      async run(ctx) {
        const { chapterId, chapterNo } = ctx.prior<ResolveOutput>("resolve");
        const plan = ctx.prior<ChapterPlan>("plan");
        const bundle = ctx.store.assembleChapterContext(ctx.input.novelId, chapterNo);
        const exemplars = searchExemplars({ type: exemplarTypeFor(chapterNo), limit: 2 });
        const { content } = await writer.writeChapter.run(
          { context: bundle, plan, exemplars },
          ctx.agents,
        );
        // 正文一产出立即落库，绝不丢稿
        const draft = ctx.store.chapters.addDraft(chapterId, { content, source: "write" });
        ctx.store.chapters.setStatus(chapterId, "drafting");
        return { draftId: draft.id };
      },
    },
    {
      id: "review",
      title: "评审与一致性审查",
      retries: 1,
      async run(ctx): Promise<DraftReview> {
        const { chapterNo } = ctx.prior<ResolveOutput>("resolve");
        const plan = ctx.prior<ChapterPlan>("plan");
        const { draftId } = ctx.prior<{ draftId: string }>("write");
        const draft = ctx.store.chapters.getDraft(draftId)!;
        const review = await reviewDraft(ctx, chapterNo, plan, draft.content);
        ctx.store.chapters.setDraftReview(draftId, review);
        return review;
      },
    },
    {
      id: "revise",
      title: "按需修订",
      async run(ctx) {
        const { chapterId, chapterNo } = ctx.prior<ResolveOutput>("resolve");
        const plan = ctx.prior<ChapterPlan>("plan");
        const threshold = ctx.input.qualityThreshold;
        const maxRounds = ctx.input.maxRevisionRounds ?? 2;

        let review = ctx.prior<DraftReview>("review");
        let draft = ctx.store.chapters.latestDraft(chapterId)!;
        let rounds = 0;

        while (rounds < maxRounds && needsRevision(review, threshold)) {
          rounds++;
          const bundle = ctx.store.assembleChapterContext(ctx.input.novelId, chapterNo);
          const { content } = await writer.reviseChapter.run(
            { context: bundle, plan, draft: draft.content, directives: buildRevisionDirectives(review) },
            ctx.agents,
          );
          draft = ctx.store.chapters.addDraft(chapterId, { content, source: "revise" });
          const newReview = await reviewDraft(ctx, chapterNo, plan, content);
          ctx.store.chapters.setDraftReview(draft.id, newReview);
          review = newReview;
        }

        ctx.store.chapters.setStatus(chapterId, "reviewed");
        const best = selectBestDraft(ctx.store.chapters, chapterId);
        return { selectedDraftId: best.id, rounds, score: best.review?.score };
      },
    },
  ],
};

// ---------- 确认章节（提取记忆 + 落库 + 滚动维护） ----------

export interface ConfirmChapterInput {
  novelId: string;
  chapterNo: number;
  /** 不传则确认最佳草稿 */
  draftId?: string;
}

export const confirmChapterWorkflow: WorkflowDefinition<ConfirmChapterInput> = {
  id: "confirmChapter",
  title: "确认章节",
  inputHint: "novelId：小说 id；chapterNo：章号；draftId：可选指定草稿",
  novelId: (input) => input.novelId,
  steps: [
    {
      id: "extract",
      title: "提取章节记忆",
      retries: 1,
      async run(ctx): Promise<ChapterMemory & { draftId: string }> {
        const { novelId, chapterNo } = ctx.input;
        const chapter = ctx.store.chapters.get(novelId, chapterNo);
        if (!chapter) {
          throw new Error(`第 ${chapterNo} 章不存在`);
        }
        const draft = ctx.input.draftId
          ? ctx.store.chapters.getDraft(ctx.input.draftId)
          : selectBestDraft(ctx.store.chapters, chapter.id);
        if (!draft) {
          throw new Error("找不到要确认的草稿");
        }
        // 门禁：一致性必须通过（CLI 已前置检查，此处兜底）
        const blockers = consistencyBlockers(draft.review?.consistency);
        if (blockers.length > 0) {
          throw new Error(`一致性审查未通过，需先修订：\n- ${blockers.join("\n- ")}`);
        }
        const bundle = ctx.store.assembleChapterContext(novelId, chapterNo);
        const memory = await memoryAgent.extractChapterMemory.run(
          { context: bundle, chapterNo, content: draft.content },
          ctx.agents,
        );
        return { ...memory, draftId: draft.id };
      },
    },
    {
      id: "persist",
      title: "写入记忆台账",
      async run(ctx) {
        const { novelId, chapterNo } = ctx.input;
        const { draftId, ...memory } = ctx.prior<ChapterMemory & { draftId: string }>("extract");
        const chapter = ctx.store.chapters.get(novelId, chapterNo)!;
        // 先回滚本章旧记忆（重新确认场景），再写新记忆——首次确认时回滚为空操作
        ctx.store.memory.rollbackChapterMemory(novelId, chapterNo);
        ctx.store.memory.applyChapterMemory(novelId, chapterNo, memory);
        ctx.store.chapters.setConfirmedDraft(chapter.id, draftId);
        ctx.store.novels.update(novelId, { status: "writing" });
        return { confirmedDraftId: draftId };
      },
    },
    {
      id: "rollup",
      title: "滚动维护摘要",
      retries: 1,
      async run(ctx) {
        const { novelId, chapterNo } = ctx.input;
        const chapter = ctx.store.chapters.get(novelId, chapterNo)!;
        const actions: string[] = [];

        const range = resolveVolumeRange(ctx.store, novelId, chapter.volumeNo);
        if (range && chapterNo === range.to) {
          await summarizeVolume(ctx, chapter.volumeNo, range);
          actions.push(`已生成第 ${chapter.volumeNo} 卷摘要`);
        }

        if (await maybeUpdateGlobalRecap(ctx, novelId, chapterNo)) {
          actions.push("已更新全局前情提要");
        }
        return { actions };
      },
    },
  ],
};

// ---------- 修改章节（AI 修订 / 润色） ----------

export interface ReviseChapterInput {
  novelId: string;
  chapterNo: number;
  mode: "revise" | "polish";
  /** revise 模式的修订指令（整章修订/重写场景/扩写/压缩都通过指令表达） */
  instruction?: string;
  styleGoal?: string;
}

export const reviseChapterWorkflow: WorkflowDefinition<ReviseChapterInput> = {
  id: "reviseChapter",
  title: "修改章节",
  inputHint: "novelId/chapterNo；mode：revise|polish；instruction：修订指令",
  novelId: (input) => input.novelId,
  steps: [
    {
      id: "rewrite",
      title: "重写正文",
      retries: 1,
      async run(ctx) {
        const { novelId, chapterNo, mode, instruction, styleGoal } = ctx.input;
        const chapter = ctx.store.chapters.get(novelId, chapterNo);
        if (!chapter?.plan) {
          throw new Error(`第 ${chapterNo} 章尚无章纲，无法修改`);
        }
        const source = ctx.store.chapters.latestDraft(chapter.id);
        if (!source) {
          throw new Error(`第 ${chapterNo} 章尚无草稿，请先写作`);
        }
        const bundle = ctx.store.assembleChapterContext(novelId, chapterNo);
        const { content } =
          mode === "polish"
            ? await writer.polishChapter.run(
                { context: bundle, draft: source.content, styleGoal },
                ctx.agents,
              )
            : await writer.reviseChapter.run(
                {
                  context: bundle,
                  plan: chapter.plan,
                  draft: source.content,
                  directives: [instruction ?? "整体提升质量"],
                },
                ctx.agents,
              );
        const draft = ctx.store.chapters.addDraft(chapter.id, {
          content,
          source: mode === "polish" ? "polish" : "revise",
        });
        return { draftId: draft.id, chapterId: chapter.id };
      },
    },
    {
      id: "review",
      title: "评审与一致性审查",
      retries: 1,
      async run(ctx) {
        const { novelId, chapterNo } = ctx.input;
        const { draftId, chapterId } = ctx.prior<{ draftId: string; chapterId: string }>("rewrite");
        const chapter = ctx.store.chapters.get(novelId, chapterNo)!;
        const draft = ctx.store.chapters.getDraft(draftId)!;
        const review = await reviewDraft(ctx, chapterNo, chapter.plan!, draft.content);
        ctx.store.chapters.setDraftReview(draftId, review);
        ctx.store.chapters.setStatus(chapterId, "reviewed");
        return { score: review.score, pass: review.consistency?.pass ?? true };
      },
    },
  ],
};

// ---------- 共享 ----------

async function reviewDraft(
  ctx: StepContext<unknown>,
  chapterNo: number,
  plan: ChapterPlan,
  content: string,
): Promise<DraftReview> {
  const bundle = ctx.store.assembleChapterContext(novelIdFromContext(ctx), chapterNo);
  const [review, consistency] = await Promise.all([
    reviewer.reviewChapter.run({ context: bundle, plan, draft: content }, ctx.agents),
    reviewer.checkConsistency.run({ context: bundle, plan, draft: content }, ctx.agents),
  ]);
  return { ...review, consistency };
}

function novelIdFromContext(ctx: StepContext<unknown>): string {
  return (ctx.input as { novelId: string }).novelId;
}

async function summarizeVolume(
  ctx: StepContext<ConfirmChapterInput>,
  volumeNo: number,
  range: { from: number; to: number },
): Promise<void> {
  const { novelId } = ctx.input;
  const chapterSummaries = ctx.store.summaries
    .listChapterSummaries(novelId, range.from, range.to)
    .map((s) => ({ chapterNo: s.refNo!, content: s.content }));
  if (chapterSummaries.length === 0) {
    return;
  }
  const volumeTitle = ctx.store.outlines.getActiveVolume(novelId, volumeNo)?.content.title;
  const { content } = await memoryAgent.summarizeVolume.run(
    { volumeNo, volumeTitle, chapterSummaries },
    ctx.agents,
  );
  ctx.store.summaries.upsert({
    novelId,
    level: "volume",
    refNo: volumeNo,
    content,
    coversToChapter: range.to,
  });
}

async function maybeUpdateGlobalRecap(
  ctx: StepContext<ConfirmChapterInput>,
  novelId: string,
  chapterNo: number,
): Promise<boolean> {
  const existing = ctx.store.summaries.get(novelId, "global");
  const coveredTo = existing?.coversToChapter ?? 0;
  if (chapterNo - coveredTo < GLOBAL_RECAP_LAG) {
    return false;
  }
  const newSummaries = ctx.store.summaries
    .listChapterSummaries(novelId, coveredTo + 1, chapterNo)
    .map((s) => ({ chapterNo: s.refNo!, content: s.content }));
  if (newSummaries.length === 0) {
    return false;
  }
  const { content } = await memoryAgent.updateGlobalRecap.run(
    { previousRecap: existing?.content, newChapterSummaries: newSummaries, coversToChapter: chapterNo },
    ctx.agents,
  );
  ctx.store.summaries.upsert({
    novelId,
    level: "global",
    content,
    coversToChapter: chapterNo,
  });
  return true;
}

function exemplarTypeFor(chapterNo: number): ExemplarType {
  return chapterNo === 1 ? "开头钩子" : "高张力对白";
}
