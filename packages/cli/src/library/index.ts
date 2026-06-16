import type { Store } from "@ai-novel-agents/store";

import { CancelError, confirm, p, select, text } from "../clack.js";
import type { AppContext } from "../context.js";
import { section } from "../render/section.js";
import { color } from "../util.js";

/** 资料库：手工查看与修正三大台账——伏笔、人物状态链、canon */
export async function libraryPanel(ctx: AppContext): Promise<void> {
  for (;;) {
    let choice: string;
    try {
      choice = await select<string>({
        message: "资料库",
        options: [
          { value: "foreshadows", label: "伏笔台账", hint: "查看/手工标记回收、废弃" },
          { value: "characters", label: "人物状态链" },
          { value: "canon", label: "Canon 事实", hint: "查看/增删" },
          { value: "back", label: "返回" },
        ],
      });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (choice === "back") return;

    try {
      if (choice === "foreshadows") await foreshadowPanel(ctx);
      else if (choice === "characters") await characterPanel(ctx.store, ctx.currentNovelId);
      else if (choice === "canon") await canonPanel(ctx);
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

async function foreshadowPanel(ctx: AppContext): Promise<void> {
  const { store, currentNovelId: novelId } = ctx;
  const foreshadows = store.foreshadows.list(novelId);
  if (foreshadows.length === 0) {
    p.log.message("暂无伏笔");
    return;
  }
  section(
    "伏笔台账",
    foreshadows
      .map((f) => {
        const window = f.expectedResolveFrom
          ? `第 ${f.expectedResolveFrom}-${f.expectedResolveTo ?? "?"} 章回收`
          : "无固定回收窗口";
        return `${statusMark(f.status)} ${f.title}（${f.importance}）— ${window}\n   ${color.dim(f.description)}`;
      })
      .join("\n"),
  );

  const open = foreshadows.filter((f) => f.status === "planted" || f.status === "advanced");
  if (open.length === 0 || !(await confirm("要手工标记某条伏笔吗？", false))) {
    return;
  }
  const id = await select<string>({
    message: "选择伏笔",
    options: open.map((f) => ({ value: f.id, label: f.title, hint: f.status })),
  });
  const action = await select<"resolved" | "abandoned">({
    message: "标记为",
    options: [
      { value: "resolved", label: "已回收" },
      { value: "abandoned", label: "已废弃" },
    ],
  });
  const atChapter = store.chapters.maxConfirmedChapterNo(novelId);
  store.foreshadows.recordEvent(id, atChapter, action, "手工标记");
  p.log.success("已更新伏笔状态");
}

async function characterPanel(store: Store, novelId: string): Promise<void> {
  const characters = store.characters.list(novelId);
  if (characters.length === 0) {
    p.log.message("暂无角色");
    return;
  }
  const id = await select<string>({
    message: "查看哪个角色的状态链？",
    options: [
      ...characters.map((c) => ({
        value: c.id,
        label: c.name,
        hint: c.role === "protagonist" ? "主角" : c.role === "major" ? "主要" : "次要",
      })),
      { value: "__back__", label: "返回" },
    ],
  });
  if (id === "__back__") return;
  const character = store.characters.get(id)!;
  const states = store.characters.recentStates(id, Number.MAX_SAFE_INTEGER, 50);
  const lines = states.map((s) => {
    const parts = [
      s.goal && `目标=${s.goal}`,
      s.emotion && `情绪=${s.emotion}`,
      s.relationships && `关系=${s.relationships}`,
      s.physical && `身体=${s.physical}`,
      s.knowledge && `知情=${s.knowledge}`,
    ].filter(Boolean);
    return `第 ${s.chapterNo} 章：${s.changeNote ?? ""}\n   ${color.dim(parts.join("；"))}`;
  });
  section(
    `${character.name} 的状态演变`,
    lines.length > 0 ? lines.join("\n") : color.dim("尚无状态记录"),
  );
}

async function canonPanel(ctx: AppContext): Promise<void> {
  const { store, currentNovelId: novelId } = ctx;
  const facts = store.canon.list(novelId);
  section(
    "Canon 事实",
    facts.length > 0
      ? facts.map((f) => `· [${f.category}] ${f.subject}：${f.fact} ${color.dim(`(第${f.establishedChapterNo}章)`)}`).join("\n")
      : color.dim("暂无 canon 事实"),
  );

  const op = await select<"add" | "remove" | "back">({
    message: "操作",
    options: [
      { value: "add", label: "新增一条" },
      { value: "remove", label: "删除一条", hint: facts.length === 0 ? "无可删" : undefined },
      { value: "back", label: "返回" },
    ],
  });
  if (op === "add") {
    const subject = await text({ message: "主语（人名/地名/物名）", validate: (v) => (v.trim() ? undefined : "必填") });
    const fact = await text({ message: "事实内容", validate: (v) => (v.trim() ? undefined : "必填") });
    store.canon.add({
      novelId,
      category: "event",
      subject: subject.trim(),
      fact: fact.trim(),
      establishedChapterNo: store.chapters.maxConfirmedChapterNo(novelId),
    });
    p.log.success("已新增");
  } else if (op === "remove" && facts.length > 0) {
    const id = await select<string>({
      message: "删除哪条？",
      options: facts.map((f) => ({ value: f.id, label: `${f.subject}：${f.fact}` })),
    });
    store.canon.remove(id);
    p.log.success("已删除");
  }
}

function statusMark(status: string): string {
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
