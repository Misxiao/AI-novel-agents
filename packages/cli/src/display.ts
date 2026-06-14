import type {
  ChapterDraft,
  ChapterMemory,
  ConsistencyReport,
  DraftReview,
} from "@ai-novel-agents/store";

import { color } from "./util.js";

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
