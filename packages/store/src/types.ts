// 全部领域类型的单一来源：谁持久化谁定义。

// ---------- 小说 ----------

export type NovelStatus = "setup" | "writing" | "finished";

export interface Novel {
  id: string;
  title: string;
  genre?: string;
  brief?: string;
  status: NovelStatus;
  createdAt: string;
  updatedAt: string;
}

// ---------- 创作资产（基础盘 / 设定） ----------

export type AssetKind = "foundation" | "setting";

export interface Foundation {
  title: string;
  genre: string;
  logline: string;
  hook: string;
  mainConflict: string;
  /** 故事引擎：让剧情可以持续产生的机制 */
  storyEngine: string;
  protagonist: {
    name: string;
    identity: string;
    want: string;
    flaw: string;
  };
  targetReaders: string;
  tone: string;
}

export interface CharacterProfile {
  identity: string;
  appearance?: string;
  personality: string;
  background: string;
  /** 长线欲望 */
  want: string;
  /** 说话方式与口癖 */
  voice?: string;
}

export interface Setting {
  worldRules: string[];
  powerSystem?: string;
  locations: Array<{ name: string; description: string }>;
  characters: Array<{
    name: string;
    role: CharacterRole;
    profile: CharacterProfile;
  }>;
  styleGuide: {
    voice: string;
    pacing: string;
    forbiddenExpressions: string[];
  };
}

export interface NovelAsset<T = unknown> {
  id: string;
  novelId: string;
  kind: AssetKind;
  version: number;
  content: T;
  status: "active" | "superseded";
  createdAt: string;
}

// ---------- 大纲 ----------

export type OutlineScope = "main" | "volume";
export type OutlineStatus = "draft" | "active" | "superseded";

export interface MainOutline {
  premise: string;
  protagonistArc: string;
  volumes: Array<{
    volumeNo: number;
    title: string;
    goal: string;
    mainConflict: string;
    /** 卷末高潮与兑现点 */
    climax: string;
    estimatedChapters: number;
  }>;
  foreshadowSeeds: Array<{
    title: string;
    description: string;
    importance: ForeshadowImportance;
    plantVolumeNo: number;
    resolveVolumeNo: number;
  }>;
  ending: string;
}

export interface VolumeOutline {
  volumeNo: number;
  title: string;
  goal: string;
  chapterRange: { from: number; to: number };
  /** 章节节拍：每拍覆盖若干章，避免逐章死纲 */
  beats: Array<{ chapters: string; summary: string }>;
  foreshadowPlan: Array<{
    foreshadowTitle: string;
    action: "plant" | "advance" | "resolve";
    aroundChapter: number;
  }>;
  endingHook: string;
}

export interface Outline<T = unknown> {
  id: string;
  novelId: string;
  scope: OutlineScope;
  volumeNo?: number;
  version: number;
  content: T;
  status: OutlineStatus;
  revisionNote?: string;
  createdAt: string;
}

// ---------- 章节 ----------

export type ChapterStatus = "planned" | "drafting" | "reviewed" | "confirmed";

export interface ChapterPlan {
  title: string;
  objective: string;
  viewpoint?: string;
  scenes: Array<{
    purpose: string;
    conflict: string;
    outcome: string;
    characters: string[];
  }>;
  foreshadowActions: Array<{
    foreshadowId: string;
    action: "plant" | "advance" | "resolve";
    how: string;
  }>;
  expectedCharacterChanges: Array<{ name: string; change: string }>;
  endingHook: string;
  targetWords: number;
}

export interface Chapter {
  id: string;
  novelId: string;
  volumeNo: number;
  chapterNo: number;
  title?: string;
  status: ChapterStatus;
  plan?: ChapterPlan;
  confirmedDraftId?: string;
  createdAt: string;
  updatedAt: string;
}

export type DraftSource = "write" | "revise" | "polish" | "manual";

export interface ChapterDraft {
  id: string;
  chapterId: string;
  version: number;
  content: string;
  wordCount: number;
  source: DraftSource;
  review?: DraftReview;
  createdAt: string;
}

// ---------- 评审 ----------

export type ConsistencyLayer =
  | "plot_logic"
  | "character_goal"
  | "emotion_relationship"
  | "body_knowledge"
  | "scene_transition"
  | "ending_hook";

export interface ConsistencyReport {
  pass: boolean;
  violations: Array<{
    layer: ConsistencyLayer;
    severity: "blocker" | "warning";
    detail: string;
    suggestion?: string;
  }>;
}

export interface DraftReview {
  /** 0-10 总分 */
  score: number;
  verdict: string;
  dimensions: Array<{ name: string; score: number; comment: string }>;
  revisionInstructions: string[];
  consistency?: ConsistencyReport;
}

// ---------- 伏笔台账 ----------

export type ForeshadowImportance = "core" | "major" | "minor";
export type ForeshadowStatus = "planted" | "advanced" | "resolved" | "abandoned";
export type ForeshadowEventKind = "planted" | "advanced" | "resolved" | "abandoned";
/** outline：来自大纲种子（长期存在，不随单章回滚）；memory：写作中涌现 */
export type ForeshadowSource = "outline" | "memory";

export interface Foreshadow {
  id: string;
  novelId: string;
  title: string;
  description: string;
  importance: ForeshadowImportance;
  status: ForeshadowStatus;
  source: ForeshadowSource;
  plantedChapterNo: number;
  expectedResolveFrom?: number;
  expectedResolveTo?: number;
  resolvedChapterNo?: number;
  createdAt: string;
  updatedAt: string;
}

export interface ForeshadowEvent {
  id: string;
  foreshadowId: string;
  chapterNo: number;
  event: ForeshadowEventKind;
  note?: string;
  createdAt: string;
}

// ---------- 角色 ----------

export type CharacterRole = "protagonist" | "major" | "minor";

export interface Character {
  id: string;
  novelId: string;
  name: string;
  role: CharacterRole;
  profile: CharacterProfile;
  firstChapterNo?: number;
  createdAt: string;
}

/** 五层状态快照：目标 / 情绪 / 关系 / 身体 / 知情 */
export interface CharacterState {
  id: string;
  characterId: string;
  chapterNo: number;
  goal?: string;
  emotion?: string;
  relationships?: string;
  physical?: string;
  knowledge?: string;
  changeNote?: string;
  createdAt: string;
}

// ---------- 摘要链 ----------

export type SummaryLevel = "chapter" | "volume" | "global";

export interface Summary {
  id: string;
  novelId: string;
  level: SummaryLevel;
  /** chapter 级为章号，volume 级为卷号，global 为空 */
  refNo?: number;
  content: string;
  /** volume/global 摘要覆盖到第几章，用于判断是否过期 */
  coversToChapter?: number;
  createdAt: string;
  updatedAt: string;
}

// ---------- Canon 事实 ----------

export type CanonCategory = "world" | "character" | "item" | "rule" | "event";

export interface CanonFact {
  id: string;
  novelId: string;
  category: CanonCategory;
  /** 主语（人名/地名/物名），用于装配时过滤 */
  subject: string;
  fact: string;
  /** 0 表示来自设定阶段 */
  establishedChapterNo: number;
  status: "active" | "retconned";
  createdAt: string;
}

// ---------- 章节记忆（确认时由 memory agent 提取） ----------

export interface ChapterMemory {
  summary: string;
  characterStates: Array<{
    name: string;
    goal?: string;
    emotion?: string;
    relationships?: string;
    physical?: string;
    knowledge?: string;
    changeNote: string;
  }>;
  foreshadowEvents: Array<{
    foreshadowId: string;
    event: "advanced" | "resolved";
    note?: string;
  }>;
  newForeshadows: Array<{
    title: string;
    description: string;
    importance: ForeshadowImportance;
    expectedResolveFrom?: number;
    expectedResolveTo?: number;
  }>;
  canonFacts: Array<{
    category: CanonCategory;
    subject: string;
    fact: string;
  }>;
}

// ---------- Workflow 运行记录 ----------

export type WorkflowRunStatus = "running" | "failed" | "completed" | "cancelled";
export type WorkflowStepStatus = "running" | "completed" | "failed" | "skipped";

export interface WorkflowRun {
  id: string;
  novelId: string;
  workflowId: string;
  status: WorkflowRunStatus;
  input: unknown;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowStepRecord {
  id: string;
  runId: string;
  stepId: string;
  seq: number;
  status: WorkflowStepStatus;
  output?: unknown;
  attempts: number;
  error?: string;
  startedAt?: string;
  finishedAt?: string;
}

export interface AgentRunRecord {
  id: string;
  novelId?: string;
  workflowRunId?: string;
  stepId?: string;
  capabilityId: string;
  provider: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs: number;
  status: "ok" | "error";
  error?: string;
  createdAt: string;
}
