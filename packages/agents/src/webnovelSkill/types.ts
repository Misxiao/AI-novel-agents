export type WebnovelModuleId =
  | "concept_planning"
  | "opening"
  | "volume_outline"
  | "plot_logic"
  | "character_consistency"
  | "transition"
  | "dialogue"
  | "chapter_ending"
  | "anti_ai_voice"
  | "consistency_review";

export type WebnovelStage =
  | "planning"
  | "opening"
  | "outline"
  | "drafting"
  | "revision"
  | "review";

export type WebnovelTaskKind =
  | "idea_diagnosis"
  | "hook_or_premise"
  | "opening"
  | "outline"
  | "chapter_draft"
  | "local_revision"
  | "chapter_review"
  | "style_cleanup";

export interface WebnovelLayerRule {
  id: string;
  name: string;
  diagnosis: string[];
  repairFocus: string[];
}

export interface WebnovelOutputContract {
  taskKind: WebnovelTaskKind;
  sections: string[];
}

export interface WebnovelMaterialHint {
  query: string;
  useFor: string;
}

export interface WebnovelModuleDefinition {
  id: WebnovelModuleId;
  name: string;
  stage: WebnovelStage;
  responsibility: string;
  triggers: string[];
  negativeSignals: string[];
  layers: WebnovelLayerRule[];
  beforeWritingPlan: string[];
  hardRules: string[];
  outputContracts: WebnovelOutputContract[];
  materialHints: WebnovelMaterialHint[];
}

export interface WebnovelRoutingInput {
  text: string;
  taskKind?: WebnovelTaskKind;
  hasDraft?: boolean;
  hasOutline?: boolean;
  hasChapterText?: boolean;
}

export interface WebnovelRoutingDecision {
  primaryModule: WebnovelModuleId;
  supportModules: WebnovelModuleId[];
  requiredFinalReview: boolean;
  chain: WebnovelModuleId[];
  reason: string;
  materialQueries: WebnovelMaterialHint[];
}

export interface WebnovelPromptContext {
  primaryModule: WebnovelModuleDefinition;
  supportModules: WebnovelModuleDefinition[];
  chain: WebnovelModuleDefinition[];
  instructions: string[];
  requiredChecks: string[];
  materialQueries: WebnovelMaterialHint[];
}

export interface WebnovelModuleRuntimeDefinition {
  id: WebnovelModuleId;
  name: string;
  stage: string;
  purpose: string;
}

