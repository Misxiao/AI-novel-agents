import type {
  ChapterContextPackage,
  ChapterDraftInput,
  ChapterPlanInput,
  ChapterReviewIssueInput,
  PlanChapterDraftOutput,
  ChapterNovelInput,
} from "../chapter/types.js";
import type { ChapterContextReference } from "../chapter/types.js";
import type { WebnovelModuleId } from "../../webnovelSkill/types.js";
export type {
  PreflightReviewIssue,
  PreflightReviewOutput,
  ReviewFoundationInput,
  ReviewOutlineInput,
  ReviewSettingInput,
} from "../preflight/types.js";

export type ChapterReviewSeverity = "info" | "warning" | "critical";
export type ChapterReviewModuleStatus = "pass" | "warn" | "fail";

export interface ReviewChapterInput {
  novel: ChapterNovelInput;
  chapterPlan: ChapterPlanInput;
  context?: ChapterContextPackage;
  draftPlan?: PlanChapterDraftOutput;
  draft: ChapterDraftInput;
  targetWords?: number;
  qualityThreshold?: number;
}

export interface ChapterReviewIssue extends ChapterReviewIssueInput {
  severity: ChapterReviewSeverity;
  category: WebnovelModuleId | "chapter_plan_coverage" | "word_count";
  description: string;
  suggestion: string;
}

export interface ChapterReviewModuleFinding {
  moduleId: WebnovelModuleId | "chapter_plan_coverage" | "word_count";
  status: ChapterReviewModuleStatus;
  finding: string;
}

export interface ChapterReviewOutput {
  reviewId: string;
  novelId: string;
  draftId: string;
  chapterPlanId: string;
  chapterNo: number;
  passed: boolean;
  overallScore: number;
  qualityThreshold: number;
  summary: string;
  strengths: string[];
  issues: ChapterReviewIssue[];
  moduleFindings: ChapterReviewModuleFinding[];
  requiredRevisionInstruction: string;
  warnings: string[];
  usedContextRefs: ChapterContextReference[];
  provider: string;
  model: string;
  createdAt: string;
}

export interface ChapterReviewJsonPayload {
  passed?: boolean;
  overallScore?: number;
  summary?: string;
  strengths?: string[];
  issues?: Array<Partial<ChapterReviewIssue>>;
  moduleFindings?: Array<Partial<ChapterReviewModuleFinding>>;
  requiredRevisionInstruction?: string;
  warnings?: string[];
}
