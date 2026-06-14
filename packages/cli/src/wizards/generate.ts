import {
  generateFoundationWorkflow,
  generateOutlineWorkflow,
  generateSettingWorkflow,
} from "@ai-novel-agents/workflow";

import { p, select, text } from "../clack.js";
import type { AppContext } from "../context.js";
import { runWf } from "../runner.js";
import { color } from "../util.js";

export async function generateFoundationWizard(ctx: AppContext): Promise<void> {
  const ideas = await text({
    message: "用几句话描述你的灵感（题材、主角、核心爽点都可以）",
    placeholder: "例：废土少年靠吞噬星核逆袭，追查姐姐失踪真相",
    validate: (v) => (v.trim().length < 4 ? "再多写一点吧" : undefined),
  });
  const genrePreference = (
    await text({ message: "题材偏好（可留空）", placeholder: "星际玄幻 / 都市修真 / 古言宅斗" })
  ).trim();

  const result = await runWf(ctx, generateFoundationWorkflow, {
    novelId: ctx.currentNovelId,
    ideas: ideas.trim(),
    genrePreference: genrePreference || undefined,
  });
  if (result.status === "completed") {
    const novel = ctx.store.novels.get(ctx.currentNovelId)!;
    p.note(
      [`书名：${novel.title}`, `题材：${novel.genre ?? ""}`, `定位：${novel.brief ?? ""}`].join("\n"),
      "基础盘已生成",
    );
  }
}

export async function generateSettingWizard(ctx: AppContext): Promise<void> {
  const extraNotes = (
    await text({ message: "对世界观/角色有什么特别要求？（可留空）", placeholder: "例：力量体系要硬核，女主要强势" })
  ).trim();
  await runWf(ctx, generateSettingWorkflow, {
    novelId: ctx.currentNovelId,
    extraNotes: extraNotes || undefined,
  });
}

export async function generateMainOutlineWizard(ctx: AppContext): Promise<void> {
  const volumeCount = await select<number>({
    message: "计划写多少卷？",
    options: [
      { value: 3, label: "3 卷（短篇试水）" },
      { value: 6, label: "6 卷（中长篇）" },
      { value: 10, label: "10 卷（长篇连载）" },
    ],
    initialValue: 6,
  });
  const chaptersPerVolume = await select<number>({
    message: "每卷大约多少章？",
    options: [
      { value: 20, label: "20 章" },
      { value: 30, label: "30 章" },
      { value: 50, label: "50 章" },
    ],
    initialValue: 30,
  });
  await runWf(ctx, generateOutlineWorkflow, {
    novelId: ctx.currentNovelId,
    scope: "main",
    volumeCount,
    chaptersPerVolume,
  });
}

export async function generateVolumeOutlineWizard(ctx: AppContext, volumeNo: number): Promise<void> {
  p.log.message(color.dim(`即将生成第 ${volumeNo} 卷的卷纲（章节节拍与伏笔安排）`));
  await runWf(ctx, generateOutlineWorkflow, {
    novelId: ctx.currentNovelId,
    scope: "volume",
    volumeNo,
  });
}
