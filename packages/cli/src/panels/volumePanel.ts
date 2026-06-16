import { resolveVolumeRange } from "@ai-novel-agents/workflow";
import type { Chapter, Foreshadow } from "@ai-novel-agents/store";

import { CancelError, p, select } from "../clack.js";
import type { AppContext } from "../context.js";
import { formatVersions, formatVolumeOutline } from "../display.js";
import { section } from "../render/section.js";
import { color } from "../util.js";
import { editOutline } from "./outlinePanel.js";
import { chapterWorkspace } from "../wizards/chapterWorkspace.js";
import { generateVolumeOutlineWizard } from "../wizards/generate.js";
import { writeChapterWizard } from "../wizards/writeChapter.js";

const CH_STATUS: Record<Chapter["status"], string> = {
  planned: "未开写",
  drafting: "草稿中",
  reviewed: "待确认",
  confirmed: "已确认",
};

interface Range {
  from: number;
  to: number;
}

/** 资源面板：卷 / 章节 —— 先选卷，进入卷工作台再到具体章节 */
export async function volumePanel(ctx: AppContext): Promise<void> {
  const main = ctx.store.outlines.getActiveMain(ctx.currentNovelId);
  if (!main) {
    p.log.warn("请先在「大纲」里生成总纲");
    return;
  }

  for (;;) {
    const confirmed = ctx.store.chapters.listByStatus(ctx.currentNovelId, "confirmed");
    const options = main.content.volumes.map((v) => {
      const range = resolveVolumeRange(ctx.store, ctx.currentNovelId, v.volumeNo);
      const hasOutline = !!ctx.store.outlines.getActiveVolume(ctx.currentNovelId, v.volumeNo);
      const total = range ? range.to - range.from + 1 : v.estimatedChapters;
      const done = range ? confirmedInRange(confirmed, range).length : 0;
      return {
        value: String(v.volumeNo),
        label: `第 ${v.volumeNo} 卷 ${v.title}`,
        hint: `${hasOutline ? "卷纲✓" : "待生成卷纲"} · ${done}/${total} 章`,
      };
    });

    let choice: string;
    try {
      choice = await select<string>({
        message: "选择卷",
        options: [...options, { value: "back", label: "返回" }],
      });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (choice === "back") return;

    try {
      await volumeWorkspace(ctx, Number(choice));
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

async function volumeWorkspace(ctx: AppContext, volumeNo: number): Promise<void> {
  for (;;) {
    const main = ctx.store.outlines.getActiveMain(ctx.currentNovelId)!;
    const meta = main.content.volumes.find((v) => v.volumeNo === volumeNo);
    const range = resolveVolumeRange(ctx.store, ctx.currentNovelId, volumeNo);
    const hasOutline = !!ctx.store.outlines.getActiveVolume(ctx.currentNovelId, volumeNo);
    printHeader(ctx, volumeNo, meta?.title, hasOutline, range);

    const options = [
      ...(hasOutline
        ? [
            { value: "view", label: "查看卷纲" },
            { value: "edit", label: "修改卷纲" },
            { value: "history", label: "卷纲历史" },
          ]
        : [{ value: "gen", label: "生成卷纲" }]),
      { value: "foreshadows", label: "本卷伏笔" },
      { value: "progress", label: "本卷进度" },
      { value: "chapters", label: "本卷章节" },
      { value: "back", label: "返回" },
    ];

    let action: string;
    try {
      action = await select<string>({ message: `第 ${volumeNo} 卷 ${meta?.title ?? ""}`.trim(), options });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (action === "back") return;

    try {
      await handle(ctx, volumeNo, range, action);
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

async function handle(
  ctx: AppContext,
  volumeNo: number,
  range: Range | undefined,
  action: string,
): Promise<void> {
  if (action === "gen") {
    await generateVolumeOutlineWizard(ctx, volumeNo);
  } else if (action === "view") {
    const volume = ctx.store.outlines.getActiveVolume(ctx.currentNovelId, volumeNo);
    if (volume) section(`第 ${volumeNo} 卷卷纲`, formatVolumeOutline(volume.content));
  } else if (action === "edit") {
    await editOutline(ctx, "volume", volumeNo);
  } else if (action === "history") {
    section(
      `第 ${volumeNo} 卷版本`,
      formatVersions(ctx.store.outlines.listVersions(ctx.currentNovelId, "volume", volumeNo)),
    );
  } else if (action === "foreshadows") {
    renderForeshadows(ctx, volumeNo, range);
  } else if (action === "progress") {
    renderProgress(ctx, volumeNo, range);
  } else if (action === "chapters") {
    await volumeChapters(ctx, volumeNo, range);
  }
}

async function volumeChapters(
  ctx: AppContext,
  volumeNo: number,
  range: Range | undefined,
): Promise<void> {
  for (;;) {
    const inRange = range
      ? ctx.store.chapters
          .list(ctx.currentNovelId)
          .filter((c) => c.status !== "planned" && c.chapterNo >= range.from && c.chapterNo <= range.to)
      : [];
    const nextNo = ctx.store.chapters.nextChapterNo(ctx.currentNovelId);
    const canWriteNext = !!range && nextNo >= range.from && nextNo <= range.to;

    if (inRange.length === 0 && !canWriteNext) {
      p.log.message("本卷还没有章节");
      return;
    }

    const options = [
      ...inRange.map((c) => ({
        value: String(c.chapterNo),
        label: `第 ${c.chapterNo} 章 ${c.title ?? ""}`,
        hint: CH_STATUS[c.status],
      })),
      ...(canWriteNext ? [{ value: "write", label: color.green(`写第 ${nextNo} 章`) }] : []),
      { value: "back", label: "返回" },
    ];

    let choice: string;
    try {
      choice = await select<string>({ message: `第 ${volumeNo} 卷 · 章节`, options });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (choice === "back") return;

    try {
      if (choice === "write") await writeChapterWizard(ctx, nextNo);
      else await chapterWorkspace(ctx, Number(choice));
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

// ---------- 渲染 ----------

function printHeader(
  ctx: AppContext,
  volumeNo: number,
  title: string | undefined,
  hasOutline: boolean,
  range: Range | undefined,
): void {
  const confirmed = ctx.store.chapters.listByStatus(ctx.currentNovelId, "confirmed");
  const done = range ? confirmedInRange(confirmed, range).length : 0;
  const total = range ? range.to - range.from + 1 : 0;
  const bits = [
    `${color.bold(`第 ${volumeNo} 卷`)} ${title ?? ""}`.trim(),
    hasOutline ? "卷纲已生成" : color.yellow("卷纲待生成"),
    `已确认 ${done}/${total} 章`,
  ];
  p.log.message(bits.join(color.dim(" · ")));
}

function renderForeshadows(ctx: AppContext, volumeNo: number, range: Range | undefined): void {
  if (!range) {
    p.log.message("本卷尚未确定章节区间");
    return;
  }
  const relevant = ctx.store.foreshadows
    .list(ctx.currentNovelId)
    .filter((f) => inVolume(f, range));
  if (relevant.length === 0) {
    section(`第 ${volumeNo} 卷伏笔`, color.dim("本卷暂无相关伏笔"));
    return;
  }
  const lines = relevant.map((f) => {
    const window = f.expectedResolveFrom
      ? `第 ${f.expectedResolveFrom}-${f.expectedResolveTo ?? "?"} 章回收`
      : "无固定回收窗口";
    return `${fsMark(f.status)} ${f.title}（${f.importance}）— 第 ${f.plantedChapterNo} 章埋 · ${window}\n   ${color.dim(f.description)}`;
  });
  section(`第 ${volumeNo} 卷伏笔`, lines.join("\n"));
}

function renderProgress(ctx: AppContext, volumeNo: number, range: Range | undefined): void {
  if (!range) {
    p.log.message("本卷尚未确定章节区间");
    return;
  }
  const confirmed = confirmedInRange(
    ctx.store.chapters.listByStatus(ctx.currentNovelId, "confirmed"),
    range,
  );
  const words = confirmed.reduce((sum, c) => {
    const draft = c.confirmedDraftId ? ctx.store.chapters.getDraft(c.confirmedDraftId) : undefined;
    return sum + (draft?.wordCount ?? 0);
  }, 0);
  const reviewed = ctx.store.chapters
    .listByStatus(ctx.currentNovelId, "reviewed")
    .filter((c) => c.chapterNo >= range.from && c.chapterNo <= range.to).length;
  section(
    `第 ${volumeNo} 卷进度`,
    [
      `章节范围：第 ${range.from}-${range.to} 章`,
      `已确认：${confirmed.length}/${range.to - range.from + 1} 章 · 约 ${(words / 10000).toFixed(1)} 万字`,
      `待确认草稿：${reviewed}`,
    ].join("\n"),
  );
}

function confirmedInRange(confirmed: Chapter[], range: Range): Chapter[] {
  return confirmed.filter((c) => c.chapterNo >= range.from && c.chapterNo <= range.to);
}

function inVolume(f: Foreshadow, range: Range): boolean {
  if (f.plantedChapterNo >= range.from && f.plantedChapterNo <= range.to) return true;
  if (f.expectedResolveFrom == null) return false;
  const resolveTo = f.expectedResolveTo ?? f.expectedResolveFrom;
  return f.expectedResolveFrom <= range.to && resolveTo >= range.from;
}

function fsMark(status: Foreshadow["status"]): string {
  switch (status) {
    case "resolved":
      return color.green("✓");
    case "abandoned":
      return color.gray("✗");
    case "advanced":
      return color.cyan("◐");
    default:
      return color.yellow("○");
  }
}
