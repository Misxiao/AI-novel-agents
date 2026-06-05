import {
  NovelDatabase,
  type StoredChapterPlan,
  type StoredNovel,
  type StoredOutlineResult,
} from "../../db/src/index.js";

export interface ChapterProductionRepositoryInput {
  novelId: string;
  chapterNo?: number;
  authorIntent?: string;
  neighborWindow?: number;
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

export interface RepositoryChapterContextPackage {
  outlineSummary?: string;
  volumeGoal?: string;
  previousChapterSummary?: string;
  nextChapterObjective?: string;
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
}

export class ChapterProductionRepository implements ChapterProductionRepositoryLike {
  constructor(private readonly db: NovelDatabase = new NovelDatabase()) {}

  assembleChapterProductionContext(input: ChapterProductionRepositoryInput): ChapterProductionAssets {
    const novel = this.db.getNovel(input.novelId);
    if (!novel) {
      throw new Error(`未找到小说项目：${input.novelId}`);
    }

    const outlineResult = this.db.getOutlineResult<RepositoryOutlineShape>(input.novelId);
    const chapterPlans = (outlineResult?.chapterPlans ?? []).map(toRepositoryChapterPlan);
    const chapterNo = input.chapterNo ?? resolveNextChapterNo(novel, chapterPlans);
    const chapterPlan = chapterPlans.find((plan) => plan.chapterNo === chapterNo);
    const neighborWindow = input.neighborWindow ?? 2;
    const nearbyChapterPlans = chapterPlans
      .filter((plan) => plan.chapterNo !== chapterNo)
      .filter((plan) => Math.abs(plan.chapterNo - chapterNo) <= neighborWindow)
      .sort((left, right) => left.chapterNo - right.chapterNo);

    const nextChapterPlan = chapterPlans.find((plan) => plan.chapterNo === chapterNo + 1);
    const sourceRefs = buildSourceRefs({
      outlineResult,
      chapterPlan,
      nearbyChapterPlans,
      authorIntent: input.authorIntent,
    });
    const missingAssets = buildMissingAssets(outlineResult, chapterPlan);
    const context: RepositoryChapterContextPackage = {
      outlineSummary: buildOutlineSummary(outlineResult?.outline, novel),
      volumeGoal: buildVolumeGoal(outlineResult?.outline, chapterPlan, novel),
      nextChapterObjective: nextChapterPlan?.objective,
      nearbyChapterPlans: nearbyChapterPlans.map((plan) => ({
        chapterNo: plan.chapterNo,
        title: plan.title,
        objective: plan.objective,
        hook: plan.hook,
        status: plan.status,
      })),
      canonFacts: buildCanonFacts(outlineResult?.outline),
      foreshadowing: buildForeshadowingContext(outlineResult?.outline),
      styleGuidance: buildStyleGuidance(novel, outlineResult?.outline),
      forbiddenExpressions: ["命运的齿轮开始转动", "一切都还没有结束"],
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
  if (input.authorIntent?.trim()) {
    refs.push({ id: "author-intent:current", type: "rag", title: "作者本章想法" });
  }
  return refs;
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
  return (outline?.timelineEvents ?? [])
    .filter((event) => event.canon)
    .slice(0, 8)
    .map((event) => `${event.title ?? "时间线事件"}：${event.summary ?? ""}`.trim());
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
    "短段落，动作优先，避免说明书式设定堆叠。",
  ];
}
