export interface ChapterNovelInput {
  novelId: string;
  title: string;
  genre: string;
  hook: string;
  targetReaders: string;
  totalChapters: number;
  currentVolume: string;
}

export interface ChapterPlanInput {
  id: string;
  novelId: string;
  chapterNo: number;
  title: string;
  volumeTitle: string;
  objective: string;
  hook: string;
  status: string;
}

export interface ChapterContextReference {
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

export interface ChapterCharacterStateInput {
  id: string;
  name: string;
  currentGoal?: string;
  emotion?: string;
  relationship?: string;
  physicalState?: string;
  voice?: string;
}

export interface ChapterForeshadowingInput {
  id: string;
  title: string;
  status: string;
  summary: string;
  payoffHint?: string;
}

export interface NeighborChapterPlanInput {
  chapterNo: number;
  title: string;
  objective: string;
  hook?: string;
  status?: string;
}

export interface ChapterContextPackage {
  outlineSummary?: string;
  volumeGoal?: string;
  previousChapterSummary?: string;
  nextChapterObjective?: string;
  nearbyChapterPlans?: NeighborChapterPlanInput[];
  characterStates?: ChapterCharacterStateInput[];
  worldRules?: string[];
  foreshadowing?: ChapterForeshadowingInput[];
  canonFacts?: string[];
  ragSnippets?: string[];
  styleGuidance?: string[];
  forbiddenExpressions?: string[];
  contextRefs?: ChapterContextReference[];
}

export interface WriteNextChapterContext extends ChapterContextPackage {}

export interface WriteNextChapterInput {
  novel: ChapterNovelInput;
  chapterPlan: ChapterPlanInput;
  context?: ChapterContextPackage;
  targetWords?: number;
}

export interface WriteNextChapterOutput {
  draftId: string;
  novelId: string;
  chapterPlanId: string;
  chapterNo: number;
  title: string;
  content: string;
  summary: string;
  wordCount: number;
  status: "draft";
  warnings: string[];
  usedContextRefs: ChapterContextReference[];
  moduleChain: string[];
  provider: string;
  model: string;
  createdAt: string;
}

export interface ChapterDraftJsonPayload {
  title?: string;
  content?: string;
  summary?: string;
  warnings?: string[];
}

export interface ChapterSceneBeat {
  sceneNo: number;
  purpose: string;
  conflict: string;
  change: string;
  keyCharacters?: string[];
}

export interface PlanChapterDraftInput {
  novel: ChapterNovelInput;
  chapterPlan: ChapterPlanInput;
  context?: ChapterContextPackage;
  targetWords?: number;
}

export interface PlanChapterDraftOutput {
  planId: string;
  novelId: string;
  chapterPlanId: string;
  chapterNo: number;
  viewpoint: string;
  objective: string;
  obstacle: string;
  change: string;
  sceneBeats: ChapterSceneBeat[];
  rewardMoment: string;
  endingHook: string;
  riskNotes: string[];
  warnings: string[];
  usedContextRefs: ChapterContextReference[];
  moduleChain: string[];
  provider: string;
  model: string;
  createdAt: string;
}

export interface ChapterDraftPlanJsonPayload {
  viewpoint?: string;
  objective?: string;
  obstacle?: string;
  change?: string;
  sceneBeats?: ChapterSceneBeat[];
  rewardMoment?: string;
  endingHook?: string;
  riskNotes?: string[];
  warnings?: string[];
}

export interface ChapterDraftInput {
  draftId: string;
  novelId: string;
  chapterPlanId?: string;
  chapterNo?: number;
  title: string;
  content: string;
  summary?: string;
}

export interface ChapterReviewIssueInput {
  id: string;
  severity?: "info" | "warning" | "critical";
  category: string;
  description: string;
  suggestion?: string;
}

export interface ReviseChapterInput {
  novel: ChapterNovelInput;
  chapterPlan: ChapterPlanInput;
  draft: ChapterDraftInput;
  context?: ChapterContextPackage;
  instruction?: string;
  reviewIssues?: ChapterReviewIssueInput[];
  targetWords?: number;
}

export interface RewriteSceneInput extends ReviseChapterInput {
  scene: {
    id?: string;
    label?: string;
    originalText: string;
  };
}

export interface ExpandTextInput extends ReviseChapterInput {
  targetWords: number;
}

export interface CompressTextInput extends ReviseChapterInput {
  targetWords: number;
}

export interface PolishStyleInput extends ReviseChapterInput {
  styleGoal?: string;
}

export interface ChapterTextOperationOutput {
  draftId: string;
  sourceDraftId: string;
  novelId: string;
  chapterPlanId: string;
  chapterNo: number;
  title: string;
  content: string;
  summary: string;
  wordCount: number;
  status: "draft";
  changedSummary: string;
  handledIssueIds: string[];
  unresolvedRisks: string[];
  warnings: string[];
  usedContextRefs: ChapterContextReference[];
  moduleChain: string[];
  provider: string;
  model: string;
  createdAt: string;
}

export interface ChapterTextOperationJsonPayload {
  title?: string;
  content?: string;
  summary?: string;
  changedSummary?: string;
  handledIssueIds?: string[];
  unresolvedRisks?: string[];
  warnings?: string[];
}
