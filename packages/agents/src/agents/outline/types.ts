import type {
  InitialOutlineDraft,
  NovelFoundationDraft,
  NovelSettingDraft,
  OutlineRevisionCandidate,
  ReviseMasterOutlineInput,
  ReviseVolumeOutlineInput,
} from "../preflight/types.js";

export interface GenerateInitialOutlineInput {
  novelId: string;
  foundation: NovelFoundationDraft;
  setting: NovelSettingDraft;
  volumeCount: number;
}

export type GenerateInitialOutlineOutput = InitialOutlineDraft;
export type InitialOutlineJsonPayload = Partial<InitialOutlineDraft>;

export type {
  OutlineRevisionCandidate,
  ReviseMasterOutlineInput,
  ReviseVolumeOutlineInput,
};

export interface OutlineRevisionJsonPayload {
  revisedOutline?: Partial<InitialOutlineDraft>;
  diffSummary?: string[];
  impactAnalysis?: Partial<OutlineRevisionCandidate["impactAnalysis"]>;
  chapterNumberChanges?: Array<Partial<OutlineRevisionCandidate["chapterNumberChanges"][number]>>;
}
