import { WEBNOVEL_CHAINS, uniqueModules } from "./chains.js";
import {
  EXECUTION_PRIORITY,
  REQUIRED_CHAPTER_REVIEW_CHECKS,
  WEBNOVEL_MODULE_BY_ID,
  WEBNOVEL_MODULES,
} from "./moduleDefinitions.js";
import type {
  WebnovelModuleId,
  WebnovelPromptContext,
  WebnovelRoutingDecision,
  WebnovelRoutingInput,
  WebnovelTaskKind,
} from "./types.js";

const TASK_KIND_PRIMARY_MODULE: Record<WebnovelTaskKind, WebnovelModuleId> = {
  idea_diagnosis: "concept_planning",
  hook_or_premise: "concept_planning",
  opening: "opening",
  outline: "volume_outline",
  chapter_draft: "plot_logic",
  local_revision: "plot_logic",
  chapter_review: "consistency_review",
  style_cleanup: "anti_ai_voice",
};

const CHINESE_WORD_BOUNDARY = /[\s，。！？、；：“”"'（）()【】\[\]{}<>《》—-]+/u;

export function routeWebnovelTask(input: WebnovelRoutingInput): WebnovelRoutingDecision {
  const normalizedText = input.text.trim();
  const keywordScores = scoreModules(normalizedText);
  const primaryModule = selectPrimaryModule(input, keywordScores);
  const supportModules = selectSupportModules(primaryModule, keywordScores, input);
  const chain = buildChain(primaryModule, supportModules, input);
  const requiredFinalReview = input.taskKind === "chapter_draft" || input.hasChapterText === true;

  return {
    primaryModule,
    supportModules,
    requiredFinalReview,
    chain,
    reason: buildReason(primaryModule, supportModules, input),
    materialQueries: chain.flatMap((moduleId) => WEBNOVEL_MODULE_BY_ID[moduleId].materialHints).slice(0, 8),
  };
}

export function buildWebnovelPromptContext(decision: WebnovelRoutingDecision): WebnovelPromptContext {
  const primaryModule = WEBNOVEL_MODULE_BY_ID[decision.primaryModule];
  const supportModules = decision.supportModules.map((moduleId) => WEBNOVEL_MODULE_BY_ID[moduleId]);
  const chain = decision.chain.map((moduleId) => WEBNOVEL_MODULE_BY_ID[moduleId]);

  return {
    primaryModule,
    supportModules,
    chain,
    materialQueries: decision.materialQueries,
    requiredChecks: decision.requiredFinalReview ? REQUIRED_CHAPTER_REVIEW_CHECKS : [],
    instructions: [
      "先判断问题属于规划、开头、章纲、正文执行、局部修复还是完稿审查。",
      "如果问题已收束到专项环节，优先使用专项模块，不输出泛泛写作建议。",
      "写作或改写前先产出最小计划，再输出正文或修改结果。",
      "素材只借结构、节奏、诊断维度和检查方法，不复用原文句面。",
      "章节正文完成后必须进入一致性审查，再决定是否允许交付。",
    ],
  };
}

function scoreModules(text: string): Map<WebnovelModuleId, number> {
  const score = new Map<WebnovelModuleId, number>();
  const terms = text.split(CHINESE_WORD_BOUNDARY).filter(Boolean);

  for (const moduleDefinition of WEBNOVEL_MODULES) {
    let moduleScore = 0;
    for (const trigger of moduleDefinition.triggers) {
      if (text.includes(trigger)) {
        moduleScore += trigger.length > 2 ? 3 : 2;
      }
    }
    for (const negativeSignal of moduleDefinition.negativeSignals) {
      if (text.includes(negativeSignal)) {
        moduleScore += 2;
      }
    }
    for (const term of terms) {
      if (moduleDefinition.triggers.includes(term)) {
        moduleScore += 1;
      }
    }
    score.set(moduleDefinition.id, moduleScore);
  }

  return score;
}

function selectPrimaryModule(
  input: WebnovelRoutingInput,
  keywordScores: Map<WebnovelModuleId, number>,
): WebnovelModuleId {
  if (input.taskKind) {
    return TASK_KIND_PRIMARY_MODULE[input.taskKind];
  }

  const sorted = [...keywordScores.entries()].sort((a, b) => b[1] - a[1]);
  if (sorted[0]?.[1] > 0) {
    return sorted[0][0];
  }

  if (!input.hasOutline) {
    return "concept_planning";
  }

  if (input.hasDraft || input.hasChapterText) {
    return "consistency_review";
  }

  return "volume_outline";
}

function selectSupportModules(
  primaryModule: WebnovelModuleId,
  keywordScores: Map<WebnovelModuleId, number>,
  input: WebnovelRoutingInput,
): WebnovelModuleId[] {
  const scored = [...keywordScores.entries()]
    .filter(([moduleId, score]) => moduleId !== primaryModule && score > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([moduleId]) => moduleId);

  const support = scored.slice(0, 3);

  if (input.taskKind === "chapter_draft") {
    support.push("character_consistency", "transition", "dialogue", "chapter_ending", "anti_ai_voice");
  }

  return uniqueModules(sortByExecutionPriority(support));
}

function buildChain(
  primaryModule: WebnovelModuleId,
  supportModules: WebnovelModuleId[],
  input: WebnovelRoutingInput,
): WebnovelModuleId[] {
  if (input.taskKind === "outline") {
    return WEBNOVEL_CHAINS.planning;
  }

  if (input.taskKind === "chapter_review" || primaryModule === "consistency_review") {
    return WEBNOVEL_CHAINS.finalReview;
  }

  if (input.taskKind === "chapter_draft") {
    return WEBNOVEL_CHAINS.chapterDraft;
  }

  const base = uniqueModules([primaryModule, ...supportModules]);
  const ordered = sortByExecutionPriority(base);

  if (input.hasChapterText && !ordered.includes("consistency_review")) {
    ordered.push("consistency_review");
  }

  return ordered;
}

function sortByExecutionPriority(modules: WebnovelModuleId[]): WebnovelModuleId[] {
  return [...modules].sort((a, b) => {
    const aIndex = EXECUTION_PRIORITY.indexOf(a);
    const bIndex = EXECUTION_PRIORITY.indexOf(b);
    if (aIndex === -1 && bIndex === -1) {
      return a.localeCompare(b);
    }
    if (aIndex === -1) {
      return -1;
    }
    if (bIndex === -1) {
      return 1;
    }
    return aIndex - bIndex;
  });
}

function buildReason(
  primaryModule: WebnovelModuleId,
  supportModules: WebnovelModuleId[],
  input: WebnovelRoutingInput,
): string {
  const primaryName = WEBNOVEL_MODULE_BY_ID[primaryModule].name;
  const supportNames = supportModules.map((moduleId) => WEBNOVEL_MODULE_BY_ID[moduleId].name);
  const taskText = input.taskKind ? `任务类型为 ${input.taskKind}` : "未显式指定任务类型";

  if (supportNames.length === 0) {
    return `${taskText}，当前问题优先进入${primaryName}。`;
  }

  return `${taskText}，当前问题优先进入${primaryName}，并由${supportNames.join("、")}辅助处理。`;
}
