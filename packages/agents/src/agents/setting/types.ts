import type { NovelFoundationDraft, NovelSettingDraft } from "../preflight/types.js";

export interface GenerateSettingDraftInput {
  novelId: string;
  seedNotes: string;
  foundation: NovelFoundationDraft;
}

export type GenerateSettingDraftOutput = NovelSettingDraft;
export type SettingJsonPayload = Partial<NovelSettingDraft>;
