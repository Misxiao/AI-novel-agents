import type {
  ChapterContextPackage,
  ChapterContextReference,
  ChapterPlanInput,
  ChapterSceneBeat,
} from "../chapter/types.js";

export interface PlanNovelInput {
  novelId: string;
  title: string;
  genre: string;
  hook: string;
  targetReaders: string;
  totalChapters: number;
  currentVolume: string;
}

export interface CreateChapterPlanInput {
  novel: PlanNovelInput;
  chapterNo: number;
  context?: ChapterContextPackage;
  authorIntent?: string;
}

export interface CreateChapterPlanOutput extends ChapterPlanInput {
  warnings: string[];
  usedContextRefs: ChapterContextReference[];
  moduleChain: string[];
  provider: string;
  model: string;
  createdAt: string;
}

export interface PlanAgentChapterPlanJsonPayload {
  title?: string;
  volumeTitle?: string;
  objective?: string;
  hook?: string;
  status?: string;
  warnings?: string[];
}

export interface CreateChapterDraftPlanInput {
  novel: PlanNovelInput;
  chapterPlan: ChapterPlanInput;
  context?: ChapterContextPackage;
  authorIntent?: string;
  targetWords?: number;
}

export interface CreateChapterDraftPlanOutput {
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

export interface PlanAgentDraftPlanJsonPayload {
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
