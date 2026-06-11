import type { NovelFoundationDraft } from "../preflight/types.js";

export interface GenerateFoundationDraftInput {
  novelId: string;
  seedNotes: string;
  targetWords?: number;
  volumeCount: number;
}

export type GenerateFoundationDraftOutput = NovelFoundationDraft;

export type FoundationJsonPayload = Partial<NovelFoundationDraft>;
