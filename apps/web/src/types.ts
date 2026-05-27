export type NovelStage = "立项" | "大纲" | "连载" | "修订" | "归档";

export type QualityState = "健康" | "关注" | "风险";

export type TaskStatus =
  | "queued"
  | "running"
  | "waiting_for_user"
  | "succeeded"
  | "failed"
  | "cancelled";

export type AssetKind = "world" | "character" | "style" | "foreshadowing";

export interface Novel {
  novelId: string;
  title: string;
  genre: string;
  stage: NovelStage;
  hook: string;
  targetReaders: string;
  totalChapters: number;
  completedChapters: number;
  qualityScore: number;
  qualityState: QualityState;
  archived: boolean;
  updatedAt: string;
  recentTask: string;
  currentVolume: string;
}

export interface NovelOverview {
  novelId: string;
  premise: string;
  chapterProgress: number;
  memoryHealth: number;
  currentGoal: string;
  nextMilestone: string;
  pendingItems: Array<{
    id: string;
    title: string;
    priority: "高" | "中" | "低";
    owner: string;
  }>;
  metrics: Array<{
    label: string;
    value: string;
    trend: string;
  }>;
}

export interface CharacterProfile {
  id: string;
  novelId: string;
  name: string;
  role: string;
  arc: string;
  voice: string;
  status: string;
}

export interface NovelAsset {
  id: string;
  novelId: string;
  kind: AssetKind;
  title: string;
  summary: string;
  tags: string[];
  updatedAt: string;
}

export interface Outline {
  novelId: string;
  logline: string;
  volumes: Array<{
    id: string;
    title: string;
    goal: string;
    status: "未开始" | "推进中" | "已完成";
  }>;
}

export interface ChapterPlan {
  id: string;
  novelId: string;
  chapterNo: number;
  title: string;
  volumeTitle: string;
  objective: string;
  hook: string;
  status: "待生成" | "草稿" | "评审中" | "待确认" | "已确认";
}

export interface ChapterDraft {
  id: string;
  novelId: string;
  chapterPlanId: string;
  version: number;
  wordCount: number;
  body: string;
  updatedAt: string;
}

export interface ChapterWorkspace {
  novelId: string;
  plan: ChapterPlan;
  draft: ChapterDraft;
  reviewSummary: string;
  versionNotes: string[];
}

export interface WorkflowTask {
  taskId: string;
  novelId: string;
  title: string;
  workflowName: string;
  status: TaskStatus;
  inputSnapshot: string;
  outputSnapshot: string;
  error?: string;
  startedAt: string;
  finishedAt?: string;
}

export interface ReviewReport {
  id: string;
  novelId: string;
  chapterNo: number;
  chapterTitle: string;
  overallScore: number;
  conclusion: string;
  dimensions: Array<{
    label: string;
    score: number;
    level: QualityState;
    comment: string;
  }>;
  recommendations: string[];
}
