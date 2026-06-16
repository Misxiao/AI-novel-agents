import {
  buildRevisionDirectives,
  reviseChapterWorkflow,
  selectBestDraft,
} from "@ai-novel-agents/workflow";
import type { Chapter, ChapterDraft } from "@ai-novel-agents/store";

import { CancelError, p, select, text } from "../clack.js";
import type { AppContext } from "../context.js";
import { formatReview, previewDraft } from "../display.js";
import { editInEditor } from "../editor.js";
import { runWf } from "../runner.js";
import { section } from "../render/section.js";
import { color } from "../util.js";
import { confirmChapterWizard } from "./confirmChapter.js";

const STATUS_LABEL: Record<Chapter["status"], string> = {
  planned: "未开写",
  drafting: "草稿中",
  reviewed: "待确认",
  confirmed: "已确认",
};

/** 选章 → 进入章节工作台（dashboard「修改章节」入口） */
export async function pickChapterAndOpen(ctx: AppContext): Promise<void> {
  const chapters = ctx.store.chapters
    .list(ctx.currentNovelId)
    .filter((c) => c.status !== "planned");
  if (chapters.length === 0) {
    p.log.warn("还没有写过章节");
    return;
  }
  let chapterNo: number;
  try {
    chapterNo = await select<number>({
      message: "进入哪一章？",
      options: [
        ...chapters
          .slice()
          .reverse()
          .map((c) => ({
            value: c.chapterNo,
            label: `第 ${c.chapterNo} 章 ${c.title ?? ""}`,
            hint: STATUS_LABEL[c.status],
          })),
        { value: 0, label: "返回" },
      ],
    });
  } catch (error) {
    if (error instanceof CancelError) return;
    throw error;
  }
  if (chapterNo === 0) return;
  await chapterWorkspace(ctx, chapterNo);
}

/** 章节工作台：查看 / 修改 / 确认，任何操作后留在本菜单（返回 = 回工作台） */
export async function chapterWorkspace(ctx: AppContext, chapterNo: number): Promise<void> {
  for (;;) {
    const chapter = ctx.store.chapters.get(ctx.currentNovelId, chapterNo);
    if (!chapter) {
      p.log.warn(`第 ${chapterNo} 章不存在`);
      return;
    }
    const draft = chapter.status === "planned" ? undefined : selectBestDraft(ctx.store.chapters, chapter.id);
    printHeader(chapter, draft);

    let action: string;
    try {
      action = await select<string>({
        message: `第 ${chapterNo} 章`,
        options: [
          ...(draft ? [{ value: "view", label: "查看正文" }] : []),
          { value: "revise", label: "修改正文…", hint: "AI 修订 / 润色 / 手工编辑" },
          ...(chapter.status === "reviewed"
            ? [{ value: "confirm", label: "确认这一章", hint: "写入记忆台账" }]
            : []),
          { value: "back", label: "返回" },
        ],
      });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (action === "back") return;

    try {
      if (action === "view" && draft) {
        section(`第 ${chapterNo} 章 ${chapter.title ?? ""}`, previewDraft(draft, 100000));
      } else if (action === "revise") {
        await reviseMenu(ctx, chapterNo, chapter.status === "confirmed");
      } else if (action === "confirm") {
        await confirmChapterWizard(ctx, chapterNo);
      }
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

type ReviseMode = "revise" | "scene" | "expand" | "compress" | "polish" | "manual" | "back";

async function reviseMenu(ctx: AppContext, chapterNo: number, wasConfirmed: boolean): Promise<void> {
  const chapter = ctx.store.chapters.get(ctx.currentNovelId, chapterNo)!;

  let mode: ReviseMode;
  try {
    mode = await select<ReviseMode>({
      message: "怎么改？",
      options: [
        { value: "revise", label: "整章修订", hint: "结合上一轮评审重写" },
        { value: "scene", label: "重写某个场景" },
        { value: "expand", label: "扩写", hint: "加长、加细节" },
        { value: "compress", label: "压缩", hint: "删冗余、提节奏" },
        { value: "polish", label: "润色去 AI 腔" },
        { value: "manual", label: "手工编辑正文（$EDITOR）" },
        { value: "back", label: "返回" },
      ],
    });
  } catch (error) {
    if (error instanceof CancelError) return;
    throw error;
  }
  if (mode === "back") return;

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
    p.log.success(`已保存第 ${draft.version} 稿（手工编辑）`);
  } else if (mode === "polish") {
    const styleGoal = (await text({ message: "润色目标（可留空）", placeholder: "例：让对白更冷硬" })).trim();
    await runWf(ctx, reviseChapterWorkflow, {
      novelId: ctx.currentNovelId,
      chapterNo,
      mode: "polish",
      styleGoal: styleGoal || undefined,
    });
  } else {
    const instruction = await buildReviseInstruction(mode);
    // 整章修订带上一轮评审意见，让 writer 真正针对问题改
    const best = selectBestDraft(ctx.store.chapters, chapter.id);
    const extraDirectives =
      mode === "revise" && best.review ? buildRevisionDirectives(best.review) : undefined;
    await runWf(ctx, reviseChapterWorkflow, {
      novelId: ctx.currentNovelId,
      chapterNo,
      mode: "revise",
      instruction,
      extraDirectives,
    });
  }

  const best = selectBestDraft(ctx.store.chapters, chapter.id);
  if (best.review) {
    section(`第 ${chapterNo} 章 · 修改后评审`, formatReview(best.review));
  }
  if (wasConfirmed) {
    p.log.warn(color.yellow("该章原已确认，记得重新「确认这一章」以更新记忆台账。"));
  }
}

async function buildReviseInstruction(mode: "revise" | "scene" | "expand" | "compress"): Promise<string> {
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
    message: "想怎么改这一章？（可留空，只按上一轮评审改）",
    placeholder: "例：开头节奏太慢，第一段就进冲突；章末钩子换成更狠的反转",
  });
  return instruction.trim();
}

async function freeText(message: string): Promise<string> {
  const value = (await text({ message })).trim();
  return value ? `补充要求：${value}` : "";
}

function printHeader(chapter: Chapter, draft: ChapterDraft | undefined): void {
  const bits = [`${color.bold(`第 ${chapter.chapterNo} 章`)} ${chapter.title ?? ""}`.trim(), STATUS_LABEL[chapter.status]];
  if (draft?.review) {
    bits.push(`评分 ${draft.review.score.toFixed(1)}`);
    bits.push(
      draft.review.consistency?.pass === false ? color.yellow("一致性未过") : "一致性通过",
    );
  }
  p.log.message(bits.join(color.dim(" · ")));
}
