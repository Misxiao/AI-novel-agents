import type { AssetStore } from "../assetStore.js";
import type { ChapterStore } from "../chapterStore.js";
import type { CharacterStore } from "../characterStore.js";
import type { CanonStore } from "../canonStore.js";
import type { ForeshadowStore } from "../foreshadowStore.js";
import type { NovelStore } from "../novelStore.js";
import type { OutlineStore } from "../outlineStore.js";
import type { SummaryStore } from "../summaryStore.js";
import type {
  CanonFact,
  Chapter,
  ChapterPlan,
  Character,
  CharacterState,
  Foreshadow,
  ForeshadowEvent,
  Foundation,
  MainOutline,
  Novel,
  Setting,
  VolumeOutline,
} from "../types.js";
import { tailAtParagraph, trimListToBudget } from "./budget.js";

export type ForeshadowDirectiveKind = "should_resolve" | "should_advance" | "keep_alive";

export interface ForeshadowDirective {
  foreshadow: Foreshadow;
  directive: ForeshadowDirectiveKind;
  history: ForeshadowEvent[];
}

export interface ActiveCharacterContext {
  character: Character;
  /** 最近数章的状态快照，按章号升序，呈现演变轨迹 */
  recentStates: CharacterState[];
}

export interface ChapterContextBundle {
  novel: Novel;
  chapterNo: number;
  volumeNo: number;
  // P0：不参与裁剪
  chapterPlan?: ChapterPlan;
  foreshadowDirectives: ForeshadowDirective[];
  activeCharacters: ActiveCharacterContext[];
  foundation?: Foundation;
  styleGuide?: Setting["styleGuide"];
  worldRules: string[];
  volumeOutline?: VolumeOutline;
  // P1：超预算时截尾
  previousChapterText?: string;
  globalRecap?: string;
  // P2：超预算时从旧到新裁剪
  recentChapterSummaries: Array<{ chapterNo: number; content: string }>;
  volumeSummaries: Array<{ volumeNo: number; content: string }>;
  canonFacts: CanonFact[];
}

export interface ContextStores {
  novels: NovelStore;
  assets: AssetStore;
  outlines: OutlineStore;
  chapters: ChapterStore;
  foreshadows: ForeshadowStore;
  characters: CharacterStore;
  summaries: SummaryStore;
  canon: CanonStore;
}

const DEFAULT_BUDGET_CHARS = 12000;
const RECENT_STATE_COUNT = 3;
const MAX_DIRECTIVES = 10;

export function assembleChapterContext(
  stores: ContextStores,
  novelId: string,
  chapterNo: number,
  budgetChars: number = DEFAULT_BUDGET_CHARS,
): ChapterContextBundle {
  const novel = stores.novels.get(novelId);
  if (!novel) {
    throw new Error(`未找到小说：${novelId}`);
  }

  const chapter = stores.chapters.get(novelId, chapterNo);
  const mainOutline = stores.outlines.getActiveMain(novelId)?.content;
  const volumeNo = resolveVolumeNo(chapter, mainOutline, stores, novelId, chapterNo);
  const volumeOutline = stores.outlines.getActiveVolume(novelId, volumeNo)?.content;

  const foundation = stores.assets.getActive<Foundation>(novelId, "foundation")?.content;
  const setting = stores.assets.getActive<Setting>(novelId, "setting")?.content;

  const foreshadowDirectives = buildForeshadowDirectives(
    stores.foreshadows,
    novelId,
    chapterNo,
    chapter?.plan,
  );
  const activeCharacters = buildActiveCharacters(
    stores.characters,
    novelId,
    chapterNo,
    chapter?.plan,
  );

  const previousChapter = stores.chapters.get(novelId, chapterNo - 1);
  const previousDraft = previousChapter?.confirmedDraftId
    ? stores.chapters.getDraft(previousChapter.confirmedDraftId)
    : undefined;

  const globalRecap = stores.summaries.get(novelId, "global");
  // 章摘要补全局提要未覆盖的空窗，至多回看 12 章
  const summaryFrom = Math.max(
    (globalRecap?.coversToChapter ?? 0) + 1,
    chapterNo - 12,
    1,
  );
  const recentChapterSummaries = stores.summaries
    .listChapterSummaries(novelId, summaryFrom, chapterNo - 1)
    .map((summary) => ({ chapterNo: summary.refNo!, content: summary.content }));

  const volumeSummaries = stores.summaries
    .listVolumeSummaries(novelId)
    .filter((summary) => summary.refNo! < volumeNo)
    .map((summary) => ({ volumeNo: summary.refNo!, content: summary.content }));

  const subjects = activeCharacters.map((entry) => entry.character.name);
  const canonFacts = stores.canon
    .list(novelId)
    .filter(
      (fact) =>
        fact.category === "world" ||
        fact.category === "rule" ||
        subjects.includes(fact.subject),
    );

  return fitBudget(
    {
      novel,
      chapterNo,
      volumeNo,
      chapterPlan: chapter?.plan,
      foreshadowDirectives,
      activeCharacters,
      foundation,
      styleGuide: setting?.styleGuide,
      worldRules: setting?.worldRules ?? [],
      volumeOutline,
      previousChapterText: previousDraft?.content,
      globalRecap: globalRecap?.content,
      recentChapterSummaries,
      volumeSummaries,
      canonFacts,
    },
    budgetChars,
  );
}

function resolveVolumeNo(
  chapter: Chapter | undefined,
  mainOutline: MainOutline | undefined,
  stores: ContextStores,
  novelId: string,
  chapterNo: number,
): number {
  if (chapter) {
    return chapter.volumeNo;
  }
  for (const outline of stores.outlines.listActiveVolumes(novelId)) {
    const { from, to } = outline.content.chapterRange;
    if (chapterNo >= from && chapterNo <= to) {
      return outline.content.volumeNo;
    }
  }
  if (mainOutline) {
    let upTo = 0;
    for (const volume of mainOutline.volumes) {
      upTo += volume.estimatedChapters;
      if (chapterNo <= upTo) {
        return volume.volumeNo;
      }
    }
  }
  return 1;
}

function buildForeshadowDirectives(
  foreshadows: ForeshadowStore,
  novelId: string,
  chapterNo: number,
  plan: ChapterPlan | undefined,
): ForeshadowDirective[] {
  const open = foreshadows.listOpen(novelId);
  const planActions = new Map(
    (plan?.foreshadowActions ?? []).map((action) => [action.foreshadowId, action.action]),
  );

  const directives: ForeshadowDirective[] = [];
  for (const foreshadow of open) {
    const due =
      foreshadow.expectedResolveFrom !== undefined &&
      foreshadow.expectedResolveFrom <= chapterNo;
    const planAction = planActions.get(foreshadow.id);

    let directive: ForeshadowDirectiveKind | undefined;
    if (planAction === "resolve" || due) {
      directive = "should_resolve";
    } else if (planAction === "advance") {
      directive = "should_advance";
    } else if (foreshadow.importance === "core") {
      directive = "keep_alive";
    }
    if (directive) {
      directives.push({
        foreshadow,
        directive,
        history: foreshadows.listEvents(foreshadow.id),
      });
    }
  }

  // 待回收优先，其次推进，keep_alive 殿后；超出上限时裁掉 keep_alive
  const order: Record<ForeshadowDirectiveKind, number> = {
    should_resolve: 0,
    should_advance: 1,
    keep_alive: 2,
  };
  directives.sort((a, b) => order[a.directive] - order[b.directive]);
  return directives.slice(0, MAX_DIRECTIVES);
}

function buildActiveCharacters(
  characters: CharacterStore,
  novelId: string,
  chapterNo: number,
  plan: ChapterPlan | undefined,
): ActiveCharacterContext[] {
  const names = new Set<string>();
  for (const scene of plan?.scenes ?? []) {
    for (const name of scene.characters) {
      names.add(name);
    }
  }
  for (const change of plan?.expectedCharacterChanges ?? []) {
    names.add(change.name);
  }

  const selected = new Map<string, Character>();
  for (const name of names) {
    const character = characters.getByName(novelId, name);
    if (character) {
      selected.set(character.id, character);
    }
  }
  // 无章纲时回落：主角 + 最近 3 章有状态变化的角色
  if (selected.size === 0) {
    for (const character of characters.list(novelId)) {
      if (character.role === "protagonist") {
        selected.set(character.id, character);
      }
    }
    for (const id of characters.activeCharacterIds(
      novelId,
      Math.max(1, chapterNo - RECENT_STATE_COUNT),
      chapterNo - 1,
    )) {
      const character = characters.get(id);
      if (character) {
        selected.set(character.id, character);
      }
    }
  }

  return [...selected.values()].map((character) => ({
    character,
    recentStates: characters.recentStates(character.id, chapterNo - 1, RECENT_STATE_COUNT),
  }));
}

function fitBudget(bundle: ChapterContextBundle, budgetChars: number): ChapterContextBundle {
  const fixedCost =
    jsonSize(bundle.chapterPlan) +
    jsonSize(bundle.foreshadowDirectives) +
    jsonSize(bundle.activeCharacters) +
    jsonSize(bundle.foundation) +
    jsonSize(bundle.styleGuide) +
    jsonSize(bundle.worldRules) +
    jsonSize(bundle.volumeOutline) +
    (bundle.globalRecap?.length ?? 0);

  // P1：前一章全文最多占剩余预算，且不超过总预算的 40%
  const previousBudget = Math.min(
    Math.max(budgetChars - fixedCost, 0),
    Math.floor(budgetChars * 0.4),
  );
  const previousChapterText = bundle.previousChapterText
    ? tailAtParagraph(bundle.previousChapterText, previousBudget)
    : undefined;

  // P2：剩余预算从旧到新保留摘要与 canon
  let remaining =
    budgetChars - fixedCost - (previousChapterText?.length ?? 0);
  const recentChapterSummaries = trimListToBudget(
    bundle.recentChapterSummaries,
    (item) => item.content.length,
    Math.max(remaining * 0.5, 0),
  );
  remaining -= recentChapterSummaries.reduce((sum, item) => sum + item.content.length, 0);
  const volumeSummaries = trimListToBudget(
    bundle.volumeSummaries,
    (item) => item.content.length,
    Math.max(remaining * 0.5, 0),
  );
  remaining -= volumeSummaries.reduce((sum, item) => sum + item.content.length, 0);
  const canonFacts = trimListToBudget(
    bundle.canonFacts,
    (fact) => fact.fact.length,
    Math.max(remaining, 0),
  );

  return {
    ...bundle,
    previousChapterText,
    recentChapterSummaries,
    volumeSummaries,
    canonFacts,
  };
}

function jsonSize(value: unknown): number {
  return value === undefined ? 0 : JSON.stringify(value).length;
}
