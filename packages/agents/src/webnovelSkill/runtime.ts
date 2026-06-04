import type { WebnovelModuleId, WebnovelModuleRuntimeDefinition } from "./types.js";

export const webnovelModuleDefinitions: WebnovelModuleRuntimeDefinition[] = [
  {
    id: "plot_logic",
    name: "剧情逻辑",
    stage: "正文执行层",
    purpose: "维护动机、触发、决策、后果和兑现",
  },
  {
    id: "character_consistency",
    name: "人物一致性",
    stage: "正文执行层",
    purpose: "维护目标、情绪、关系、身体和声音连续性",
  },
  {
    id: "transition",
    name: "转场",
    stage: "正文执行层",
    purpose: "处理时间、空间、情绪、视角和章节承接",
  },
  {
    id: "dialogue",
    name: "对白",
    stage: "正文执行层",
    purpose: "让对白承载关系压力、人物声音、信息嵌入和局面推进",
  },
  {
    id: "chapter_ending",
    name: "章末",
    stage: "正文执行层",
    purpose: "处理章末落点、后劲、回钩和下一章承接",
  },
  {
    id: "anti_ai_voice",
    name: "去 AI 味",
    stage: "风格约束层",
    purpose: "清理空泛总结、套话氛围、说明书对白和统一腔调",
  },
  {
    id: "consistency_review",
    name: "一致性审查",
    stage: "完稿收口层",
    purpose: "章节完稿后统一检查六项一致性",
  },
];

export const chapterDraftModuleChain: WebnovelModuleId[] = [
  "plot_logic",
  "character_consistency",
  "transition",
  "dialogue",
  "chapter_ending",
  "anti_ai_voice",
];

export const chapterFinalReviewModule: WebnovelModuleId = "consistency_review";

export function buildChapterModuleChain(includeFinalReview = true): WebnovelModuleId[] {
  return includeFinalReview
    ? [...chapterDraftModuleChain, chapterFinalReviewModule]
    : [...chapterDraftModuleChain];
}

export function buildChapterModulePromptLines() {
  const definitions = new Map(webnovelModuleDefinitions.map((item) => [item.id, item]));

  return buildChapterModuleChain(true).map((id, index) => {
    const module = definitions.get(id);
    const label = module ? `${module.name}：${module.purpose}` : id;
    return `${index + 1}. ${id} / ${label}`;
  });
}
