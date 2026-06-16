import {
  reviseAssetWorkflow,
  reviseChapterWorkflow,
  reviseOutlineWorkflow,
  selectBestDraft,
} from "@ai-novel-agents/workflow";
import type { Foundation, Setting } from "@ai-novel-agents/store";

import { confirm, p, select, text } from "../clack.js";
import type { AppContext } from "../context.js";
import { formatReview } from "../display.js";
import { editInEditor } from "../editor.js";
import { runWf } from "../runner.js";
import { section } from "../render/section.js";
import { color } from "../util.js";

// ---------- 修改基础盘 / 设定 ----------

export async function reviseAssetWizard(ctx: AppContext): Promise<void> {
  const kind = await select<"foundation" | "setting">({
    message: "修改哪个资产？",
    options: [
      { value: "foundation", label: "基础盘", hint: "定位/卖点/主角" },
      { value: "setting", label: "设定", hint: "世界观/角色/文风" },
    ],
  });
  const useEditor = await select<"ai" | "manual">({
    message: "怎么改？",
    options: [
      { value: "ai", label: "告诉 AI 怎么改" },
      { value: "manual", label: "手工编辑 JSON（$EDITOR）" },
    ],
  });

  if (useEditor === "manual") {
    const current = ctx.store.assets.getActive<Foundation | Setting>(ctx.currentNovelId, kind);
    if (!current) {
      p.log.warn("该资产尚未生成");
      return;
    }
    const edited = editInEditor(JSON.stringify(current.content, null, 2), "json");
    if (!edited) {
      p.log.message("未改动");
      return;
    }
    try {
      ctx.store.assets.saveVersion(ctx.currentNovelId, kind, JSON.parse(edited));
      p.log.success("已保存为新版本");
    } catch {
      p.log.error("JSON 解析失败，未保存");
    }
    return;
  }

  const instruction = await text({
    message: "想怎么改？",
    placeholder: "例：把主角的弱点改成「过度自信」，并强化反派动机",
    validate: (v) => (v.trim().length < 2 ? "请描述修改内容" : undefined),
  });
  const result = await runWf(ctx, reviseAssetWorkflow, {
    novelId: ctx.currentNovelId,
    kind,
    instruction: instruction.trim(),
  });
  showRevisionNote(result.outputs["revise"]);
}

// ---------- 修改大纲 ----------

export async function reviseOutlineWizard(ctx: AppContext): Promise<void> {
  const volumes = ctx.store.outlines.listActiveVolumes(ctx.currentNovelId);
  const scope = await select<"main" | "volume">({
    message: "修改总纲还是卷纲？",
    options: [
      { value: "main", label: "总纲" },
      { value: "volume", label: "卷纲", hint: volumes.length === 0 ? "暂无卷纲" : `${volumes.length} 卷` },
    ],
  });

  let volumeNo: number | undefined;
  if (scope === "volume") {
    if (volumes.length === 0) {
      p.log.warn("还没有卷纲");
      return;
    }
    volumeNo = await select<number>({
      message: "改哪一卷？",
      options: volumes.map((v) => ({
        value: v.content.volumeNo,
        label: `第 ${v.content.volumeNo} 卷 ${v.content.title}`,
      })),
    });
  }

  const instruction = await text({
    message: "想怎么改？",
    placeholder: "例：把第 2 卷的反派提前到第 3 章登场",
    validate: (v) => (v.trim().length < 2 ? "请描述修改内容" : undefined),
  });
  const result = await runWf(ctx, reviseOutlineWorkflow, {
    novelId: ctx.currentNovelId,
    scope,
    volumeNo,
    instruction: instruction.trim(),
  });
  showRevisionNote(result.outputs["revise"]);
}

// ---------- 修改章节 ----------

export async function reviseChapterWizard(
  ctx: AppContext,
  presetChapterNo?: number,
): Promise<void> {
  const novelId = ctx.currentNovelId;

  let chapterNo: number;
  if (presetChapterNo != null) {
    chapterNo = presetChapterNo;
  } else {
    const chapters = ctx.store.chapters
      .list(novelId)
      .filter((c) => c.status === "reviewed" || c.status === "confirmed");
    if (chapters.length === 0) {
      p.log.warn("还没有可修改的章节");
      return;
    }
    chapterNo = await select<number>({
      message: "改哪一章？",
      options: chapters
        .slice()
        .reverse()
        .map((c) => ({
          value: c.chapterNo,
          label: `第 ${c.chapterNo} 章 ${c.title ?? ""}`,
          hint: c.status === "confirmed" ? "已确认" : "待确认",
        })),
    });
  }
  const chapter = ctx.store.chapters.get(novelId, chapterNo)!;

  const mode = await select<"revise" | "scene" | "expand" | "compress" | "polish" | "manual">({
    message: "怎么改？",
    options: [
      { value: "revise", label: "整章修订", hint: "按你的指令重写" },
      { value: "scene", label: "重写某个场景" },
      { value: "expand", label: "扩写", hint: "加长、加细节" },
      { value: "compress", label: "压缩", hint: "删冗余、提节奏" },
      { value: "polish", label: "润色去 AI 腔" },
      { value: "manual", label: "手工编辑正文（$EDITOR）" },
    ],
  });

  if (mode === "manual") {
    const source = ctx.store.chapters.latestDraft(chapter.id);
    if (!source) {
      p.log.warn("该章还没有正文");
      return;
    }
    const edited = editInEditor(source.content);
    if (!edited) {
      p.log.message("未改动");
      return;
    }
    const draft = ctx.store.chapters.addDraft(chapter.id, { content: edited, source: "manual" });
    ctx.store.chapters.setStatus(chapter.id, "reviewed");
    p.log.success(`已保存第 ${draft.version} 稿（手工编辑），可重新确认`);
    return;
  }

  if (mode === "polish") {
    const styleGoal = (await text({ message: "润色目标（可留空）", placeholder: "例：让对白更冷硬" })).trim();
    await runWf(ctx, reviseChapterWorkflow, {
      novelId,
      chapterNo,
      mode: "polish",
      styleGoal: styleGoal || undefined,
    });
  } else {
    const instruction = await buildReviseInstruction(mode);
    await runWf(ctx, reviseChapterWorkflow, { novelId, chapterNo, mode: "revise", instruction });
  }

  const best = selectBestDraft(ctx.store.chapters, chapter.id);
  if (best.review) {
    section(`第 ${chapterNo} 章 · 修改后评审`, formatReview(best.review));
  }
  if (chapter.status === "confirmed") {
    p.log.warn(color.yellow("该章原已确认，修改后需重新确认才会更新记忆台账。"));
    if (await confirm("现在重新确认吗？")) {
      const { confirmChapterWizard } = await import("./confirmChapter.js");
      await confirmChapterWizard(ctx, chapterNo);
    }
  }
}

async function buildReviseInstruction(
  mode: "revise" | "scene" | "expand" | "compress",
): Promise<string> {
  if (mode === "expand") {
    return `扩写本章，重点加强动作、感官细节和人物反应，不新增无来源的重大设定。${await freeText("还有什么具体要求？（可留空）")}`;
  }
  if (mode === "compress") {
    return `压缩本章，删去重复说明和拖沓过渡，保留因果、关键对白和章末钩子。${await freeText("还有什么具体要求？（可留空）")}`;
  }
  if (mode === "scene") {
    const scene = await text({
      message: "描述要重写的场景",
      placeholder: "例：林尘和苏晚在天台对峙那一段",
      validate: (v) => (v.trim().length < 2 ? "请描述场景" : undefined),
    });
    return `只重写以下场景，保持整章其余部分稳定：${scene.trim()}`;
  }
  const instruction = await text({
    message: "想怎么改这一章？",
    placeholder: "例：开头节奏太慢，第一段就进冲突；章末钩子换成更狠的反转",
    validate: (v) => (v.trim().length < 2 ? "请描述修改内容" : undefined),
  });
  return instruction.trim();
}

async function freeText(message: string): Promise<string> {
  const value = (await text({ message })).trim();
  return value ? `补充要求：${value}` : "";
}

function showRevisionNote(output: unknown): void {
  const note = (output as { revisionNote?: string } | undefined)?.revisionNote;
  if (note) {
    p.log.success(`已保存新版本：${note}`);
  }
}
