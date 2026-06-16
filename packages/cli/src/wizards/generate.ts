import {
  generateFoundationWorkflow,
  generateOutlineWorkflow,
  generateSettingWorkflow,
} from "@ai-novel-agents/workflow";
import type { Foundation, Setting } from "@ai-novel-agents/store";

import { chooseNumber, p, text } from "../clack.js";
import type { AppContext } from "../context.js";
import {
  formatFoundation,
  formatMainOutline,
  formatSetting,
  formatVolumeOutline,
} from "../display.js";
import { runWf } from "../runner.js";
import { section } from "../render/section.js";
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
    const foundation = ctx.store.assets.getActive<Foundation>(ctx.currentNovelId, "foundation");
    if (foundation) section("基础盘已生成", formatFoundation(foundation.content));
  }
}

export async function generateSettingWizard(ctx: AppContext): Promise<void> {
  const extraNotes = (
    await text({ message: "对世界观/角色有什么特别要求？（可留空）", placeholder: "例：力量体系要硬核，女主要强势" })
  ).trim();
  const result = await runWf(ctx, generateSettingWorkflow, {
    novelId: ctx.currentNovelId,
    extraNotes: extraNotes || undefined,
  });
  if (result.status === "completed") {
    const setting = ctx.store.assets.getActive<Setting>(ctx.currentNovelId, "setting");
    if (setting) section("设定已生成", formatSetting(setting.content));
  }
}

export async function generateMainOutlineWizard(ctx: AppContext): Promise<void> {
  p.log.message(
    color.dim(
      "总纲是粗粒度的卷级规划，整书章数 ≈ 卷数 × 每卷章节数（如 8×300≈2400、5×200≈1000）。\n" +
        "卷纲会在写作时再把每卷细化到逐章；每章约 2500 字。",
    ),
  );
  const volumeCount = await chooseNumber({
    message: "计划写多少卷？",
    options: [5, 8, 12],
    initialValue: 8,
    min: 1,
    max: 30,
    unit: " 卷",
  });
  const chaptersPerVolume = await chooseNumber({
    message: "每卷大约多少章？",
    options: [200, 300, 400],
    initialValue: 300,
    min: 20,
    max: 1000,
    unit: " 章",
  });

  const result = await runWf(ctx, generateOutlineWorkflow, {
    novelId: ctx.currentNovelId,
    scope: "main",
    volumeCount,
    chaptersPerVolume,
  });
  if (result.status === "completed") {
    const main = ctx.store.outlines.getActiveMain(ctx.currentNovelId);
    if (main) {
      section("总纲已生成", formatMainOutline(main.content));
      const total = main.content.volumes.reduce((sum, v) => sum + v.estimatedChapters, 0);
      p.log.message(color.dim(`预计全书约 ${total} 章、${(total * 2500 / 10000).toFixed(0)} 万字。`));
    }
  }
}

export async function generateVolumeOutlineWizard(ctx: AppContext, volumeNo: number): Promise<void> {
  const authorNotes = (
    await text({
      message: `第 ${volumeNo} 卷你想怎么写？（可留空，由 AI 按总纲推进）`,
      placeholder: "例：本卷主打势力对抗，卷末让主角痛失一位队友",
    })
  ).trim();
  const result = await runWf(ctx, generateOutlineWorkflow, {
    novelId: ctx.currentNovelId,
    scope: "volume",
    volumeNo,
    authorNotes: authorNotes || undefined,
  });
  if (result.status === "completed") {
    const volume = ctx.store.outlines.getActiveVolume(ctx.currentNovelId, volumeNo);
    if (volume) section(`第 ${volumeNo} 卷卷纲已生成`, formatVolumeOutline(volume.content));
  }
}
