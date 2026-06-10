import {
  NovelDatabase,
  type ConfirmNovelOutlineInput,
  type PreflightAssetKind,
  type SavePreflightAssetInput,
  type SaveOutlineRevisionVersionInput,
  type StoredChapterContext,
  type StoredChapterPlan,
  type StoredNovel,
  type StoredOutlineResult,
  type StoredOutlineRevisionVersion,
  type StoredPreflightAsset,
  type StoredWorkflowTask,
  type TaskStatus,
  type UpdateNovelInput,
} from "../../db/src/index.js";

export interface NovelWorkspaceRepositoryLike {
  listNovels(): StoredNovel[];
  createEmptyNovel(): StoredNovel;
  getNovel(novelId: string): StoredNovel | null;
  updateNovel(novelId: string, input: UpdateNovelInput): StoredNovel | null;
  listTasks(novelId: string, status?: TaskStatus): StoredWorkflowTask[];
  getTask(taskId: string): StoredWorkflowTask | null;
  saveTask(task: StoredWorkflowTask): StoredWorkflowTask;
  getDraft<TAsset>(
    novelId: string,
    kind: PreflightAssetKind,
  ): StoredPreflightAsset<TAsset> | null;
  getOutlineVersion<TVersion>(
    novelId: string,
    versionId: string,
  ): StoredOutlineRevisionVersion<TVersion> | null;
  listOutlineVersions<TVersion>(
    novelId: string,
  ): StoredOutlineRevisionVersion<TVersion>[];
  getLatestOutlineVersion<TVersion>(
    novelId: string,
  ): StoredOutlineRevisionVersion<TVersion> | null;
}

export class NovelWorkspaceRepository implements NovelWorkspaceRepositoryLike {
  constructor(private readonly db: NovelDatabase = new NovelDatabase()) {}

  listNovels() {
    return this.db.listNovels();
  }

  createEmptyNovel() {
    return this.db.createEmptyNovel();
  }

  getNovel(novelId: string) {
    return this.db.getNovel(novelId);
  }

  updateNovel(novelId: string, input: UpdateNovelInput) {
    return this.db.updateNovel(novelId, input);
  }

  listTasks(novelId: string, status?: TaskStatus) {
    return this.db.listTasks(novelId, status);
  }

  getTask(taskId: string) {
    return this.db.getTask(taskId);
  }

  saveTask(task: StoredWorkflowTask) {
    return this.db.saveWorkflowTask(task);
  }

  getDraft<TAsset>(novelId: string, kind: PreflightAssetKind) {
    return this.db.getPreflightAsset<TAsset>(novelId, kind);
  }

  getOutlineVersion<TVersion>(novelId: string, versionId: string) {
    return this.db.getOutlineRevisionVersion<TVersion>(novelId, versionId);
  }

  listOutlineVersions<TVersion>(novelId: string) {
    return this.db.listOutlineRevisionVersions<TVersion>(novelId);
  }

  getLatestOutlineVersion<TVersion>(novelId: string) {
    return this.db.getLatestOutlineRevisionVersion<TVersion>(novelId);
  }
}

export interface NovelPreflightRepositoryLike {
  createEmptyNovel(): StoredNovel;
  getNovel(novelId: string): StoredNovel | null;
  saveDraft<TAsset>(input: SavePreflightAssetInput<TAsset>): StoredPreflightAsset<TAsset>;
  getDraft<TAsset>(novelId: string, kind: PreflightAssetKind): StoredPreflightAsset<TAsset> | null;
  saveTask(task: StoredWorkflowTask): StoredWorkflowTask;
  saveOutlineVersion<TVersion>(
    input: SaveOutlineRevisionVersionInput<TVersion>,
  ): StoredOutlineRevisionVersion<TVersion>;
  getOutlineVersion<TVersion>(
    novelId: string,
    versionId: string,
  ): StoredOutlineRevisionVersion<TVersion> | null;
  listOutlineVersions<TVersion>(
    novelId: string,
  ): StoredOutlineRevisionVersion<TVersion>[];
  getLatestOutlineVersion<TVersion>(
    novelId: string,
  ): StoredOutlineRevisionVersion<TVersion> | null;
  listConfirmedChapterContexts(novelId: string): StoredChapterContext[];
  confirmOutline<
    TFoundation,
    TSetting,
    TOutline extends { novelId: string; volumes?: Array<{ title?: string }> },
  >(
    input: ConfirmNovelOutlineInput<TFoundation, TSetting, TOutline>,
  ): StoredOutlineResult<TOutline>;
}

export class NovelPreflightRepository implements NovelPreflightRepositoryLike {
  constructor(private readonly db: NovelDatabase = new NovelDatabase()) {}

  createEmptyNovel() {
    return this.db.createEmptyNovel();
  }

  getNovel(novelId: string) {
    return this.db.getNovel(novelId);
  }

  saveDraft<TAsset>(input: SavePreflightAssetInput<TAsset>) {
    return this.db.savePreflightAsset(input);
  }

  getDraft<TAsset>(novelId: string, kind: PreflightAssetKind) {
    return this.db.getPreflightAsset<TAsset>(novelId, kind);
  }

  saveTask(task: StoredWorkflowTask) {
    return this.db.saveWorkflowTask(task);
  }

  saveOutlineVersion<TVersion>(input: SaveOutlineRevisionVersionInput<TVersion>) {
    return this.db.saveOutlineRevisionVersion(input);
  }

  getOutlineVersion<TVersion>(novelId: string, versionId: string) {
    return this.db.getOutlineRevisionVersion<TVersion>(novelId, versionId);
  }

  listOutlineVersions<TVersion>(novelId: string) {
    return this.db.listOutlineRevisionVersions<TVersion>(novelId);
  }

  getLatestOutlineVersion<TVersion>(novelId: string) {
    return this.db.getLatestOutlineRevisionVersion<TVersion>(novelId);
  }

  listConfirmedChapterContexts(novelId: string) {
    return this.db.listChapterContexts(novelId, "confirmed");
  }

  confirmOutline<
    TFoundation,
    TSetting,
    TOutline extends { novelId: string; volumes?: Array<{ title?: string }> },
  >(
    input: ConfirmNovelOutlineInput<TFoundation, TSetting, TOutline>,
  ) {
    return this.db.confirmNovelOutline(input);
  }
}

export interface ChapterProductionRepositoryInput {
  novelId: string;
  chapterNo?: number;
  authorIntent?: string;
  neighborWindow?: number;
  contextWindow?: Partial<ChapterContextWindowPolicy>;
}

export interface RepositoryChapterNovel {
  novelId: string;
  title: string;
  genre: string;
  hook: string;
  targetReaders: string;
  totalChapters: number;
  currentVolume: string;
}

export interface RepositoryChapterPlan {
  id: string;
  novelId: string;
  chapterNo: number;
  title: string;
  volumeId?: string;
  volumeTitle: string;
  objective: string;
  hook: string;
  status: string;
}

export interface RepositoryContextReference {
  id: string;
  type:
    | "outline"
    | "volume"
    | "chapter"
    | "character"
    | "world_rule"
    | "foreshadowing"
    | "canon"
    | "style"
    | "rag";
  title?: string;
}

export interface RepositoryChapterContextWindowItem {
  chapterNo: number;
  title: string;
  summary?: string;
  content?: string;
  endingHook?: string;
  endingExcerpt?: string;
  status?: string;
}

export interface RepositoryChapterContextPackage {
  outlineSummary?: string;
  volumeGoal?: string;
  previousChapterSummary?: string;
  previousChapterEnding?: string;
  previousChapters?: RepositoryChapterContextWindowItem[];
  nextChapterObjective?: string;
  nextChapters?: RepositoryChapterContextWindowItem[];
  nearbyChapterPlans?: Array<{
    chapterNo: number;
    title: string;
    objective: string;
    hook?: string;
    status?: string;
  }>;
  characterStates?: Array<{
    id: string;
    name: string;
    currentGoal?: string;
    emotion?: string;
    relationship?: string;
    physicalState?: string;
    voice?: string;
  }>;
  worldRules?: string[];
  foreshadowing?: Array<{
    id: string;
    title: string;
    status: string;
    summary: string;
    payoffHint?: string;
  }>;
  canonFacts?: string[];
  ragSnippets?: string[];
  styleGuidance?: string[];
  forbiddenExpressions?: string[];
  contextRefs?: RepositoryContextReference[];
}

export interface ChapterContextWindowPolicy {
  previousFullChapterCount: number;
  previousSummaryCount: number;
  nextFullChapterCount: number;
  nextSummaryCount: number;
  previousPlanCount: number;
  nextPlanCount: number;
}

export interface ChapterProductionAssets {
  novel: RepositoryChapterNovel;
  chapterNo: number;
  chapterPlan?: RepositoryChapterPlan;
  chapterPlans: RepositoryChapterPlan[];
  nearbyChapterPlans: RepositoryChapterPlan[];
  context: RepositoryChapterContextPackage;
  missingAssets: string[];
  sourceRefs: RepositoryContextReference[];
}

export interface ChapterProductionRepositoryLike {
  assembleChapterProductionContext(input: ChapterProductionRepositoryInput): ChapterProductionAssets;
  saveTask?(task: StoredWorkflowTask): StoredWorkflowTask;
  saveChapterDraft?(input: {
    novelId: string;
    chapterNo: number;
    title: string;
    summary: string;
    content: string;
    endingHook?: string;
  }): StoredChapterContext;
}

export class ChapterProductionRepository implements ChapterProductionRepositoryLike {
  constructor(private readonly db: NovelDatabase = new NovelDatabase()) {}

  saveTask(task: StoredWorkflowTask) {
    return this.db.saveWorkflowTask(task);
  }

  saveChapterDraft(input: {
    novelId: string;
    chapterNo: number;
    title: string;
    summary: string;
    content: string;
    endingHook?: string;
  }) {
    return this.db.saveChapterContext({
      ...input,
      status: "draft",
    });
  }

  assembleChapterProductionContext(input: ChapterProductionRepositoryInput): ChapterProductionAssets {
    const novel = this.db.getNovel(input.novelId);
    if (!novel) {
      throw new Error(`未找到小说项目：${input.novelId}`);
    }

    const outlineResult = this.db.getOutlineResult<RepositoryOutlineShape>(input.novelId);
    const chapterPlans = (outlineResult?.chapterPlans ?? []).map(toRepositoryChapterPlan);
    const chapterNo = input.chapterNo ?? resolveNextChapterNo(novel, chapterPlans);
    const chapterPlan = chapterPlans.find((plan) => plan.chapterNo === chapterNo);
    const windowPolicy = normalizeContextWindowPolicy(input);
    const nearbyChapterPlans = buildNearbyChapterPlans(chapterPlans, chapterNo, windowPolicy);
    const chapterContexts = this.db.listChapterContexts(input.novelId, "confirmed");
    const previousChapters = buildChapterContextWindow({
      chapters: chapterContexts.filter((chapter) => chapter.chapterNo < chapterNo),
      direction: "previous",
      fullCount: windowPolicy.previousFullChapterCount,
      summaryCount: windowPolicy.previousSummaryCount,
    });
    const nextChapters = buildChapterContextWindow({
      chapters: chapterContexts.filter((chapter) => chapter.chapterNo > chapterNo),
      direction: "next",
      fullCount: windowPolicy.nextFullChapterCount,
      summaryCount: windowPolicy.nextSummaryCount,
    });
    const previousChapter = previousChapters.at(-1);

    const nextChapterPlan = chapterPlans.find((plan) => plan.chapterNo === chapterNo + 1);
    const sourceRefs = buildSourceRefs({
      outlineResult,
      chapterPlan,
      nearbyChapterPlans,
      previousChapters,
      nextChapters,
      authorIntent: input.authorIntent,
    });
    const missingAssets = buildMissingAssets(outlineResult, chapterPlan);
    const context: RepositoryChapterContextPackage = {
      outlineSummary: buildOutlineSummary(outlineResult?.outline, novel),
      volumeGoal: buildVolumeGoal(outlineResult?.outline, chapterPlan, novel),
      previousChapterSummary: previousChapter?.summary,
      previousChapterEnding: previousChapter?.endingExcerpt,
      previousChapters,
      nextChapterObjective: nextChapterPlan?.objective,
      nextChapters,
      nearbyChapterPlans: nearbyChapterPlans.map((plan) => ({
        chapterNo: plan.chapterNo,
        title: plan.title,
        objective: plan.objective,
        hook: plan.hook,
        status: plan.status,
      })),
      characterStates: buildCharacterStates(outlineResult?.outline),
      worldRules: outlineResult?.outline.setting?.worldRules ?? [],
      canonFacts: buildCanonFacts(outlineResult?.outline),
      foreshadowing: buildForeshadowingContext(outlineResult?.outline),
      styleGuidance: buildStyleGuidance(novel, outlineResult?.outline),
      forbiddenExpressions: outlineResult?.outline.forbiddenExpressions
        ?? ["命运的齿轮开始转动", "一切都还没有结束"],
      ragSnippets: input.authorIntent?.trim() ? [`作者本章想法：${input.authorIntent.trim()}`] : [],
      contextRefs: sourceRefs,
    };

    return {
      novel: toRepositoryChapterNovel(novel),
      chapterNo,
      chapterPlan,
      chapterPlans,
      nearbyChapterPlans,
      context,
      missingAssets,
      sourceRefs,
    };
  }
}

interface RepositoryOutlineShape {
  novelId: string;
  logline?: string;
  baseline?: {
    hook?: string;
    sellingPoint?: string;
    mainConflict?: string;
    storyEngine?: string;
    synopsisExcerpt?: string;
  };
  masterOutline?: {
    mainGoal?: string;
    escalation?: string;
    protagonistArc?: string;
  };
  volumes?: Array<{
    id?: string;
    title?: string;
    goal?: string;
    conflict?: string;
    chapterRange?: string;
  }>;
  foreshadowing?: Array<{
    id?: string;
    title?: string;
    status?: string;
    summary?: string;
    payoffAt?: string;
  }>;
  timelineEvents?: Array<{
    title?: string;
    summary?: string;
    canon?: boolean;
  }>;
  setting?: {
    worldRules?: string[];
    characterSeeds?: Array<{
      id: string;
      name: string;
      desire?: string;
      conflict?: string;
      initialState?: string;
      arcHint?: string;
    }>;
  };
  styleGuidance?: string[];
  forbiddenExpressions?: string[];
  canonCandidates?: string[];
}

function resolveNextChapterNo(novel: StoredNovel, chapterPlans: RepositoryChapterPlan[]) {
  const nextByProgress = novel.completedChapters + 1;
  const nextExistingPlan = chapterPlans.find((plan) => plan.chapterNo >= nextByProgress);
  return nextExistingPlan?.chapterNo ?? nextByProgress;
}

function toRepositoryChapterNovel(novel: StoredNovel): RepositoryChapterNovel {
  return {
    novelId: novel.novelId,
    title: novel.title,
    genre: novel.genre,
    hook: novel.hook,
    targetReaders: novel.targetReaders,
    totalChapters: novel.totalChapters,
    currentVolume: novel.currentVolume,
  };
}

function toRepositoryChapterPlan(plan: StoredChapterPlan): RepositoryChapterPlan {
  return {
    id: plan.id,
    novelId: plan.novelId,
    chapterNo: plan.chapterNo,
    title: plan.title,
    volumeId: plan.volumeId,
    volumeTitle: plan.volumeTitle,
    objective: plan.objective,
    hook: plan.hook,
    status: plan.status,
  };
}

function buildSourceRefs(input: {
  outlineResult?: StoredOutlineResult<RepositoryOutlineShape> | null;
  chapterPlan?: RepositoryChapterPlan;
  nearbyChapterPlans: RepositoryChapterPlan[];
  previousChapters: RepositoryChapterContextWindowItem[];
  nextChapters: RepositoryChapterContextWindowItem[];
  authorIntent?: string;
}): RepositoryContextReference[] {
  const refs: RepositoryContextReference[] = [];
  if (input.outlineResult) {
    refs.push({ id: `outline:${input.outlineResult.outline.novelId}`, type: "outline", title: "总纲" });
  }
  if (input.chapterPlan) {
    refs.push({ id: `chapter-plan:${input.chapterPlan.id}`, type: "chapter", title: input.chapterPlan.title });
  }
  for (const plan of input.nearbyChapterPlans) {
    refs.push({ id: `chapter-plan:${plan.id}`, type: "chapter", title: `第 ${plan.chapterNo} 章：${plan.title}` });
  }
  for (const chapter of [...input.previousChapters, ...input.nextChapters]) {
    refs.push({ id: `chapter-context:${chapter.chapterNo}`, type: "chapter", title: `第 ${chapter.chapterNo} 章：${chapter.title}` });
  }
  if (input.authorIntent?.trim()) {
    refs.push({ id: "author-intent:current", type: "rag", title: "作者本章想法" });
  }
  return refs;
}

function normalizeContextWindowPolicy(input: ChapterProductionRepositoryInput): ChapterContextWindowPolicy {
  const symmetricalPlanWindow = input.neighborWindow;
  return {
    previousFullChapterCount: normalizeWindowCount(input.contextWindow?.previousFullChapterCount, 1),
    previousSummaryCount: normalizeWindowCount(input.contextWindow?.previousSummaryCount, 3),
    nextFullChapterCount: normalizeWindowCount(input.contextWindow?.nextFullChapterCount, 1),
    nextSummaryCount: normalizeWindowCount(input.contextWindow?.nextSummaryCount, 3),
    previousPlanCount: normalizeWindowCount(input.contextWindow?.previousPlanCount ?? symmetricalPlanWindow, 3),
    nextPlanCount: normalizeWindowCount(input.contextWindow?.nextPlanCount ?? symmetricalPlanWindow, 3),
  };
}

function normalizeWindowCount(value: number | undefined, fallback: number) {
  if (!Number.isFinite(value)) {
    return fallback;
  }
  return Math.max(0, Math.floor(value ?? fallback));
}

function buildNearbyChapterPlans(
  chapterPlans: RepositoryChapterPlan[],
  chapterNo: number,
  policy: ChapterContextWindowPolicy,
) {
  const previous = chapterPlans
    .filter((plan) => plan.chapterNo < chapterNo)
    .sort((left, right) => right.chapterNo - left.chapterNo)
    .slice(0, policy.previousPlanCount)
    .reverse();
  const next = chapterPlans
    .filter((plan) => plan.chapterNo > chapterNo)
    .sort((left, right) => left.chapterNo - right.chapterNo)
    .slice(0, policy.nextPlanCount);
  return [...previous, ...next];
}

function buildChapterContextWindow(input: {
  chapters: StoredChapterContext[];
  direction: "previous" | "next";
  fullCount: number;
  summaryCount: number;
}): RepositoryChapterContextWindowItem[] {
  const sorted = input.direction === "previous"
    ? [...input.chapters].sort((left, right) => right.chapterNo - left.chapterNo)
    : [...input.chapters].sort((left, right) => left.chapterNo - right.chapterNo);
  const selected = sorted.slice(0, input.summaryCount);
  const fullChapterNos = new Set(
    selected.slice(0, input.fullCount).map((chapter) => chapter.chapterNo),
  );
  const chronological = input.direction === "previous" ? [...selected].reverse() : selected;

  return chronological.map((chapter) => ({
    chapterNo: chapter.chapterNo,
    title: chapter.title,
    summary: chapter.summary,
    content: fullChapterNos.has(chapter.chapterNo) ? chapter.content : undefined,
    endingHook: chapter.endingHook,
    endingExcerpt: chapter.endingExcerpt,
    status: chapter.status,
  }));
}

function buildMissingAssets(outlineResult?: StoredOutlineResult<RepositoryOutlineShape> | null, chapterPlan?: RepositoryChapterPlan) {
  const missing: string[] = [];
  if (!outlineResult) {
    missing.push("outline");
  }
  if (!chapterPlan) {
    missing.push("chapterPlan");
  }
  return missing;
}

function buildOutlineSummary(outline: RepositoryOutlineShape | undefined, novel: StoredNovel) {
  if (!outline) {
    return `当前小说尚未生成总纲。小说核心钩子：${novel.hook}`;
  }

  return [
    outline.logline,
    outline.baseline?.sellingPoint ? `卖点：${outline.baseline.sellingPoint}` : undefined,
    outline.baseline?.mainConflict ? `主冲突：${outline.baseline.mainConflict}` : undefined,
    outline.baseline?.storyEngine ? `故事引擎：${outline.baseline.storyEngine}` : undefined,
    outline.masterOutline?.mainGoal ? `主线目标：${outline.masterOutline.mainGoal}` : undefined,
    outline.masterOutline?.escalation ? `升级路径：${outline.masterOutline.escalation}` : undefined,
  ].filter(Boolean).join("\n");
}

function buildVolumeGoal(outline: RepositoryOutlineShape | undefined, chapterPlan: RepositoryChapterPlan | undefined, novel: StoredNovel) {
  const volume = outline?.volumes?.find((item) => item.title === chapterPlan?.volumeTitle)
    ?? outline?.volumes?.find((item) => item.title === novel.currentVolume)
    ?? outline?.volumes?.[0];

  if (!volume) {
    return novel.currentVolume;
  }

  return [volume.title, volume.goal, volume.conflict].filter(Boolean).join("：");
}

function buildCanonFacts(outline: RepositoryOutlineShape | undefined) {
  return [
    ...(outline?.canonCandidates ?? []),
    ...(outline?.timelineEvents ?? [])
      .filter((event) => event.canon)
      .map((event) => `${event.title ?? "时间线事件"}：${event.summary ?? ""}`.trim()),
  ].slice(0, 8);
}

function buildForeshadowingContext(outline: RepositoryOutlineShape | undefined) {
  return (outline?.foreshadowing ?? []).slice(0, 8).map((item, index) => ({
    id: item.id ?? `foreshadowing-${index + 1}`,
    title: item.title ?? `伏笔 ${index + 1}`,
    status: item.status ?? "未知",
    summary: item.summary ?? "",
    payoffHint: item.payoffAt,
  }));
}

function buildStyleGuidance(novel: StoredNovel, outline: RepositoryOutlineShape | undefined) {
  return [
    `题材：${novel.genre}`,
    `目标读者：${novel.targetReaders}`,
    outline?.baseline?.hook ? `核心 hook：${outline.baseline.hook}` : `核心 hook：${novel.hook}`,
    ...(outline?.styleGuidance ?? []),
    "短段落，动作优先，避免说明书式设定堆叠。",
  ];
}

function buildCharacterStates(outline: RepositoryOutlineShape | undefined) {
  return (outline?.setting?.characterSeeds ?? []).map((character) => ({
    id: character.id,
    name: character.name,
    currentGoal: character.desire,
    emotion: character.conflict,
    physicalState: character.initialState,
    voice: character.arcHint,
  }));
}
