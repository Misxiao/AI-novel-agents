import type { ChapterPlanInput } from "../chapter/types.js";

export type PreflightDraftStatus = "草稿" | "待确认" | "已确认" | "需修订";
export type PreflightAssetKind = "foundation" | "setting" | "outline";

export interface NovelFoundationDraft {
  novelId: string;
  titleCandidates: string[];
  synopsis: string;
  hook: string;
  sellingPoint: string;
  premise: string;
  mainConflict: string;
  storyEngine: string;
  targetReaders: string;
  tone: string;
  targetWords: number;
  estimatedChapters: number;
  estimatedVolumes: number;
  chapterWordTarget: number;
  risks: string[];
  questionsForAuthor: string[];
  status: PreflightDraftStatus;
}

export interface CharacterSeed {
  id: string;
  name: string;
  role: string;
  desire: string;
  conflict: string;
  initialState: string;
  arcHint: string;
}

export interface RelationshipSeed {
  id: string;
  fromCharacterId: string;
  toCharacterId: string;
  relation: string;
  tension: string;
}

export interface NovelSettingDraft {
  novelId: string;
  background: string;
  worldRules: string[];
  powerSystem?: string;
  factions: string[];
  locations: string[];
  constraints: string[];
  characterSeeds: CharacterSeed[];
  relationshipSeeds: RelationshipSeed[];
  styleGuidance: string[];
  forbiddenExpressions: string[];
  canonCandidates: string[];
  risks: string[];
  status: PreflightDraftStatus;
}

export interface VolumePlanDraft {
  id: string;
  title: string;
  goal: string;
  conflict: string;
  highlights: string[];
  chapterRange: string;
  status: "未开始" | "推进中" | "已完成";
}

export interface TimelineEventDraft {
  id: string;
  volumeId?: string;
  title: string;
  storyTime: string;
  narrativePosition: string;
  summary: string;
  characters: string[];
  causality: string;
  canon: boolean;
  risk?: string;
}

export interface ForeshadowingDraft {
  id: string;
  volumeId?: string;
  title: string;
  plantedAt: string;
  payoffAt: string;
  status: "已埋设" | "推进中" | "待回收" | "已回收" | "风险";
  summary: string;
  relatedCharacters: string[];
  risk?: string;
}

export interface OutlineIssueDraft {
  id: string;
  level: "健康" | "关注" | "风险";
  title: string;
  detail: string;
}

export interface InitialOutlineDraft {
  novelId: string;
  masterOutline: {
    opening: string;
    mainGoal: string;
    escalation: string;
    climax: string;
    ending: string;
    protagonistArc: string;
  };
  volumes: VolumePlanDraft[];
  chapterPlans: ChapterPlanInput[];
  timelineEvents: TimelineEventDraft[];
  foreshadowing: ForeshadowingDraft[];
  issues: OutlineIssueDraft[];
  status: PreflightDraftStatus;
}

export interface PreflightReviewIssue {
  id: string;
  severity: "info" | "warning" | "critical";
  category: string;
  description: string;
  suggestion: string;
}

export interface PreflightReviewOutput {
  reviewId: string;
  novelId: string;
  assetKind: PreflightAssetKind;
  passed: boolean;
  overallScore: number;
  summary: string;
  strengths: string[];
  issues: PreflightReviewIssue[];
  requiredRevisionInstruction: string;
  warnings: string[];
  provider: string;
  model: string;
  createdAt: string;
}

export interface ReviewFoundationInput {
  novelId: string;
  draft: NovelFoundationDraft;
}

export interface ReviewSettingInput {
  novelId: string;
  foundation: NovelFoundationDraft;
  draft: NovelSettingDraft;
}

export interface ReviewOutlineInput {
  novelId: string;
  foundation: NovelFoundationDraft;
  setting: NovelSettingDraft;
  draft: InitialOutlineDraft;
}

export type OutlineRevisionScope = "master" | "volume";

export interface OutlineRevisionConflict {
  id: string;
  severity: "info" | "warning" | "critical";
  category: string;
  description: string;
  suggestion: string;
}

export interface OutlineStructureIdMapping {
  kind: "volume" | "chapter";
  sourceIds: string[];
  targetIds: string[];
}

export interface OutlineRevisionImpactAnalysis {
  affectedVolumeIds: string[];
  affectedChapterPlanIds: string[];
  affectedTimelineEventIds: string[];
  affectedForeshadowingIds: string[];
  structuralChanges: string[];
  conflicts: OutlineRevisionConflict[];
  idMappings: OutlineStructureIdMapping[];
}

export interface ChapterNumberChange {
  chapterPlanId: string;
  from: number;
  to: number;
}

export interface OutlineRevisionCandidate {
  revisedOutline: InitialOutlineDraft;
  diffSummary: string[];
  impactAnalysis: OutlineRevisionImpactAnalysis;
  chapterNumberChanges: ChapterNumberChange[];
}

export interface ReviseMasterOutlineInput {
  novelId: string;
  instruction: string;
  foundation: NovelFoundationDraft;
  setting: NovelSettingDraft;
  sourceOutline: InitialOutlineDraft;
  protectedChapterPlans: ChapterPlanInput[];
}

export interface ReviseVolumeOutlineInput extends ReviseMasterOutlineInput {
  volumeId: string;
}

export interface ReviewOutlineRevisionInput {
  novelId: string;
  scope: OutlineRevisionScope;
  targetVolumeId?: string;
  foundation: NovelFoundationDraft;
  setting: NovelSettingDraft;
  sourceOutline: InitialOutlineDraft;
  candidate: OutlineRevisionCandidate;
}
