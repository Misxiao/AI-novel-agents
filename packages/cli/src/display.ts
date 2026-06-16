import type {
  ChapterDraft,
  ChapterMemory,
  ConsistencyReport,
  DraftReview,
  Foundation,
  MainOutline,
  Setting,
  VolumeOutline,
} from "@ai-novel-agents/store";

import { color } from "./util.js";

export function formatFoundation(foundation: Foundation): string {
  return [
    `${color.bold("书名")}：${foundation.title}`,
    `${color.bold("题材")}：${foundation.genre}`,
    `${color.bold("定位")}：${foundation.logline}`,
    `${color.bold("卖点")}：${foundation.hook}`,
    `${color.bold("主冲突")}：${foundation.mainConflict}`,
    `${color.bold("故事引擎")}：${foundation.storyEngine}`,
    `${color.bold("主角")}：${foundation.protagonist.name}（${foundation.protagonist.identity}）` +
      ` 想要：${foundation.protagonist.want}；弱点：${foundation.protagonist.flaw}`,
    `${color.bold("基调")}：${foundation.tone}`,
  ].join("\n");
}

export function formatSetting(setting: Setting): string {
  const lines: string[] = [];
  lines.push(color.cyan("世界规则："));
  for (const rule of setting.worldRules) lines.push(`  · ${rule}`);
  if (setting.powerSystem) lines.push(`${color.cyan("力量体系")}：${setting.powerSystem}`);
  if (setting.locations.length > 0) {
    lines.push(color.cyan("地点："));
    for (const loc of setting.locations) lines.push(`  · ${loc.name}：${color.dim(loc.description)}`);
  }
  lines.push(color.cyan("角色："));
  for (const c of setting.characters) {
    lines.push(`  · ${c.name}（${roleLabel(c.role)}）想要：${c.profile.want}`);
    lines.push(color.dim(`     ${c.profile.identity}；${c.profile.personality}`));
  }
  lines.push(
    `${color.cyan("文风")}：${setting.styleGuide.voice}；${setting.styleGuide.pacing}`,
  );
  if (setting.styleGuide.forbiddenExpressions.length > 0) {
    lines.push(color.dim(`禁用表达：${setting.styleGuide.forbiddenExpressions.join("、")}`));
  }
  return lines.join("\n");
}

export function formatMainOutline(outline: MainOutline): string {
  const lines = [`${color.bold("前提")}：${outline.premise}`, `${color.bold("主角弧线")}：${outline.protagonistArc}`];
  lines.push(color.cyan(`卷划分（共 ${outline.volumes.length} 卷）：`));
  for (const v of outline.volumes) {
    lines.push(`  第 ${v.volumeNo} 卷《${v.title}》 约 ${v.estimatedChapters} 章`);
    lines.push(color.dim(`     目标：${v.goal}；卷末：${v.climax}`));
  }
  if (outline.foreshadowSeeds.length > 0) {
    lines.push(color.cyan("伏笔种子："));
    for (const f of outline.foreshadowSeeds) {
      lines.push(`  · [${f.importance}] ${f.title}（第 ${f.plantVolumeNo} 卷埋→第 ${f.resolveVolumeNo} 卷收）`);
      lines.push(color.dim(`     ${f.description}`));
    }
  }
  lines.push(`${color.bold("结局")}：${outline.ending}`);
  return lines.join("\n");
}

export function formatVolumeOutline(outline: VolumeOutline): string {
  const lines = [
    `${color.bold(`第 ${outline.volumeNo} 卷《${outline.title}》`)}`,
    `${color.bold("本卷目标")}：${outline.goal}`,
    `${color.bold("章节范围")}：第 ${outline.chapterRange.from}–${outline.chapterRange.to} 章`,
    color.cyan("节拍："),
  ];
  for (const beat of outline.beats) lines.push(`  · 第 ${beat.chapters} 章：${beat.summary}`);
  if (outline.foreshadowPlan.length > 0) {
    lines.push(color.cyan("伏笔安排："));
    for (const f of outline.foreshadowPlan) {
      lines.push(`  · ${f.foreshadowTitle}：第 ${f.aroundChapter} 章${actionLabel(f.action)}`);
    }
  }
  lines.push(`${color.bold("卷末钩子")}：${outline.endingHook}`);
  return lines.join("\n");
}

function roleLabel(role: string): string {
  return role === "protagonist" ? "主角" : role === "major" ? "主要" : "次要";
}

function actionLabel(action: string): string {
  return action === "plant" ? "埋设" : action === "resolve" ? "回收" : "推进";
}

export function formatReview(review: DraftReview): string {
  const lines = [
    `${color.bold("评分")}：${scoreColor(review.score)}  ${color.dim(review.verdict)}`,
  ];
  for (const dim of review.dimensions) {
    lines.push(`  · ${dim.name} ${scoreColor(dim.score)} ${color.dim(dim.comment)}`);
  }
  if (review.revisionInstructions.length > 0) {
    lines.push(color.yellow("  修订建议："));
    for (const item of review.revisionInstructions) {
      lines.push(`    - ${item}`);
    }
  }
  if (review.consistency) {
    lines.push(formatConsistency(review.consistency));
  }
  return lines.join("\n");
}

export function formatConsistency(report: ConsistencyReport): string {
  if (report.pass && report.violations.length === 0) {
    return `${color.green("一致性")}：通过`;
  }
  const head = report.pass
    ? `${color.green("一致性")}：通过（含提醒）`
    : `${color.red("一致性")}：未通过`;
  const lines = [head];
  for (const violation of report.violations) {
    const tag = violation.severity === "blocker" ? color.red("阻断") : color.yellow("提醒");
    lines.push(`  [${tag}] ${violation.layer}：${violation.detail}`);
    if (violation.suggestion) {
      lines.push(color.dim(`         → ${violation.suggestion}`));
    }
  }
  return lines.join("\n");
}

export function formatMemory(memory: ChapterMemory): string {
  const lines = [`${color.bold("章摘要")}：${memory.summary}`];
  if (memory.characterStates.length > 0) {
    lines.push(color.cyan("人物状态："));
    for (const state of memory.characterStates) {
      lines.push(`  · ${state.name}：${state.changeNote}`);
    }
  }
  if (memory.foreshadowEvents.length > 0) {
    lines.push(color.cyan(`伏笔推进：${memory.foreshadowEvents.length} 条`));
  }
  if (memory.newForeshadows.length > 0) {
    lines.push(color.cyan("新增伏笔：" + memory.newForeshadows.map((f) => f.title).join("、")));
  }
  if (memory.canonFacts.length > 0) {
    lines.push(color.cyan(`新增设定事实：${memory.canonFacts.length} 条`));
  }
  return lines.join("\n");
}

export function previewDraft(draft: ChapterDraft, maxChars = 600): string {
  const body = draft.content.length > maxChars
    ? draft.content.slice(0, maxChars) + color.dim("……（节选）")
    : draft.content;
  return `${color.dim(`第 ${draft.version} 稿 · ${draft.wordCount} 字`)}\n${body}`;
}

function scoreColor(score: number): string {
  const text = score.toFixed(1);
  if (score >= 8.5) return color.green(text);
  if (score >= 7.5) return color.cyan(text);
  return color.yellow(text);
}
