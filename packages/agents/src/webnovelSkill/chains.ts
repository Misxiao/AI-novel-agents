import type { WebnovelModuleId } from "./types.js";

export const WEBNOVEL_CHAINS = {
  planning: ["concept_planning", "opening", "volume_outline"] satisfies WebnovelModuleId[],
  chapterDraft: [
    "plot_logic",
    "character_consistency",
    "transition",
    "dialogue",
    "chapter_ending",
    "anti_ai_voice",
    "consistency_review",
  ] satisfies WebnovelModuleId[],
  localRevision: [
    "plot_logic",
    "character_consistency",
    "transition",
    "dialogue",
    "chapter_ending",
    "anti_ai_voice",
  ] satisfies WebnovelModuleId[],
  finalReview: ["consistency_review"] satisfies WebnovelModuleId[],
};

export function uniqueModules(modules: WebnovelModuleId[]): WebnovelModuleId[] {
  return Array.from(new Set(modules));
}
