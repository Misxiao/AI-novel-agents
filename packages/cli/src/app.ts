import { writeChapterWorkflow } from "@ai-novel-agents/workflow";

import { CancelError, confirm, p, select } from "./clack.js";
import type { AppContext } from "./context.js";
import { libraryPanel } from "./library/index.js";
import { suggestNextStep, type Suggestion } from "./nextStep.js";
import { runWf } from "./runner.js";
import { gatherStatus, type NovelStatus } from "./status.js";
import { color, formatTokens } from "./util.js";
import { createNovel } from "./wizards/createNovel.js";
import { confirmChapterWizard } from "./wizards/confirmChapter.js";
import {
  generateFoundationWizard,
  generateMainOutlineWizard,
  generateSettingWizard,
  generateVolumeOutlineWizard,
} from "./wizards/generate.js";
import { reviseAssetWizard, reviseChapterWizard, reviseOutlineWizard } from "./wizards/revise.js";
import { writeChapterWizard } from "./wizards/writeChapter.js";

export async function runApp(ctx: AppContext): Promise<void> {
  p.intro(color.magenta(color.bold("AI 小说创作工作台")) + (ctx.mock ? color.dim(" · 离线演练模式") : ""));

  for (;;) {
    const novelId = await pickNovel(ctx);
    if (!novelId) break;
    ctx.currentNovelId = novelId;
    try {
      await dashboardLoop(ctx);
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }

  p.outro(color.dim("再见，祝码字顺利。"));
}

// ---------- 选择 / 新建小说 ----------

async function pickNovel(ctx: AppContext): Promise<string | undefined> {
  const novels = ctx.store.novels.list();
  const choice = await select<string>({
    message: "选择小说",
    options: [
      ...novels.map((n) => ({
        value: n.id,
        label: `《${n.title}》`,
        hint: novelHint(ctx, n.id),
      })),
      { value: "__new__", label: color.cyan("＋ 新建小说") },
      { value: "__quit__", label: "退出" },
    ],
  }).catch((error) => {
    if (error instanceof CancelError) return "__quit__";
    throw error;
  });

  if (choice === "__quit__") return undefined;
  if (choice === "__new__") {
    const id = createNovel(ctx);
    p.log.success("已创建空白小说，先从生成基础盘开始。");
    return id;
  }
  return choice;
}

function novelHint(ctx: AppContext, novelId: string): string {
  const status = gatherStatus(ctx.store, novelId);
  if (!status.hasFoundation) return "待立项";
  if (status.confirmedCount === 0) return "筹备中";
  return `已写 ${status.confirmedCount} 章`;
}

// ---------- 仪表盘主循环 ----------

async function dashboardLoop(ctx: AppContext): Promise<void> {
  for (;;) {
    const status = gatherStatus(ctx.store, ctx.currentNovelId);
    printStatus(status);
    const suggestion = suggestNextStep(ctx.store, status);

    const action = await select<string>({
      message: "下一步",
      options: buildMenu(status, suggestion),
      initialValue: "__suggested__",
    });

    if (action === "__quit__") return;
    if (action === "__switch__") return;

    try {
      await dispatch(ctx, action === "__suggested__" ? suggestion.action : action, suggestion, status);
    } catch (error) {
      if (error instanceof CancelError) {
        p.log.message(color.dim("已取消，返回工作台。"));
      } else {
        throw error;
      }
    }
  }
}

function printStatus(status: NovelStatus): void {
  const stage = !status.hasFoundation
    ? "待立项"
    : !status.hasMainOutline
      ? "筹备大纲"
      : "连载中";
  const bits = [
    `${color.bold(`《${status.novel.title}》`)} ${color.dim(stage)}`,
    `已确认 ${color.cyan(status.confirmedCount)} 章`,
    `下一章 第 ${color.cyan(status.nextChapterNo)} 章`,
  ];
  if (status.reviewedChapterNos.length > 0) {
    bits.push(color.yellow(`待确认 ${status.reviewedChapterNos.length}`));
  }
  if (status.dueForeshadows > 0) {
    bits.push(color.yellow(`伏笔待回收 ${status.dueForeshadows}`));
  }
  bits.push(color.dim(`${formatTokens(status.totalTokens)} tokens`));
  p.log.message(bits.join(color.dim(" · ")));
}

function buildMenu(
  status: NovelStatus,
  suggestion: Suggestion,
): Array<{ value: string; label: string; hint?: string }> {
  const options: Array<{ value: string; label: string; hint?: string }> = [
    { value: "__suggested__", label: color.green(`★ ${suggestion.label}`), hint: "回车执行" },
  ];
  if (status.hasMainOutline) {
    options.push({ value: "write", label: "写下一章" });
  }
  if (status.reviewedChapterNos.length > 0) {
    options.push({ value: "confirm", label: "确认待确认章" });
  }
  if (status.hasFoundation) {
    options.push({ value: "reviseAsset", label: "修改基础盘 / 设定" });
  }
  if (status.hasMainOutline) {
    options.push({ value: "reviseOutline", label: "修改大纲" });
    options.push({ value: "reviseChapter", label: "修改章节" });
  }
  options.push({ value: "library", label: "资料库", hint: "伏笔 / 人物 / canon / 版本" });
  options.push({ value: "__switch__", label: "切换 / 新建小说" });
  options.push({ value: "__quit__", label: "退出" });
  return options;
}

// ---------- 动作分发 ----------

async function dispatch(
  ctx: AppContext,
  action: string,
  suggestion: Suggestion,
  status: NovelStatus,
): Promise<void> {
  switch (action) {
    case "resume":
      await resume(ctx, suggestion);
      return;
    case "foundation":
      await generateFoundationWizard(ctx);
      return;
    case "setting":
      await generateSettingWizard(ctx);
      return;
    case "mainOutline":
      await generateMainOutlineWizard(ctx);
      return;
    case "volumeOutline":
      await generateVolumeOutlineWizard(ctx, status.currentVolumeNo);
      return;
    case "write":
      await writeChapterWizard(ctx, suggestion.chapterNo ?? status.nextChapterNo);
      return;
    case "confirm":
      await confirmChapterWizard(
        ctx,
        suggestion.chapterNo ?? Math.min(...status.reviewedChapterNos),
      );
      return;
    case "reviseAsset":
      await reviseAssetWizard(ctx);
      return;
    case "reviseOutline":
      await reviseOutlineWizard(ctx);
      return;
    case "reviseChapter":
      await reviseChapterWizard(ctx);
      return;
    case "library":
      await libraryPanel(ctx);
      return;
  }
}

async function resume(ctx: AppContext, suggestion: Suggestion): Promise<void> {
  if (!suggestion.runId) return;
  const run = ctx.store.runs.getRun(suggestion.runId);
  if (!run || run.workflowId !== "writeChapter") {
    // 目前仅写章流程支持断点续跑；其他流程重跑即可
    if (await confirm("放弃这个中断的流程吗？")) {
      ctx.store.runs.setRunStatus(suggestion.runId, "cancelled");
    }
    return;
  }
  await runWf(ctx, writeChapterWorkflow, run.input as { novelId: string }, {
    resumeRunId: suggestion.runId,
  });
}
