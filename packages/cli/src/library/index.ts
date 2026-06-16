import type { Foundation, Setting, Store } from "@ai-novel-agents/store";

import { CancelError, confirm, p, select, text } from "../clack.js";
import type { AppContext } from "../context.js";
import {
  formatFoundation,
  formatMainOutline,
  formatSetting,
  formatVolumeOutline,
  previewDraft,
} from "../display.js";
import { section } from "../render/section.js";
import { color } from "../util.js";

/** 资料库：查看创作资产/大纲/章节，并手工修正伏笔、人物、canon */
export async function libraryPanel(ctx: AppContext): Promise<void> {
  for (;;) {
    let choice: string;
    try {
      choice = await select<string>({
        message: "资料库",
        options: [
          { value: "foundation", label: "基础盘" },
          { value: "setting", label: "设定", hint: "世界观/角色/文风" },
          { value: "outline", label: "大纲", hint: "总纲与卷纲" },
          { value: "chapter", label: "章节正文" },
          { value: "foreshadows", label: "伏笔台账", hint: "查看/手工标记回收、废弃" },
          { value: "characters", label: "人物状态链" },
          { value: "canon", label: "Canon 事实", hint: "查看/增删" },
          { value: "versions", label: "版本历史" },
          { value: "back", label: "返回" },
        ],
      });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (choice === "back") return;

    try {
      if (choice === "foundation") foundationPanel(ctx.store, ctx.currentNovelId);
      else if (choice === "setting") settingPanel(ctx.store, ctx.currentNovelId);
      else if (choice === "outline") await outlinePanel(ctx.store, ctx.currentNovelId);
      else if (choice === "chapter") await chapterTextPanel(ctx.store, ctx.currentNovelId);
      else if (choice === "foreshadows") await foreshadowPanel(ctx);
      else if (choice === "characters") await characterPanel(ctx.store, ctx.currentNovelId);
      else if (choice === "canon") await canonPanel(ctx);
      else if (choice === "versions") await versionPanel(ctx.store, ctx.currentNovelId);
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

function foundationPanel(store: Store, novelId: string): void {
  const asset = store.assets.getActive<Foundation>(novelId, "foundation");
  if (!asset) {
    p.log.message("尚未生成基础盘");
    return;
  }
  section("基础盘", formatFoundation(asset.content));
}

function settingPanel(store: Store, novelId: string): void {
  const asset = store.assets.getActive<Setting>(novelId, "setting");
  if (!asset) {
    p.log.message("尚未生成设定");
    return;
  }
  section("设定", formatSetting(asset.content));
}

async function outlinePanel(store: Store, novelId: string): Promise<void> {
  const main = store.outlines.getActiveMain(novelId);
  if (!main) {
    p.log.message("尚未生成总纲");
    return;
  }
  section("总纲", formatMainOutline(main.content));

  const volumes = store.outlines.listActiveVolumes(novelId);
  if (volumes.length === 0) {
    return;
  }
  const volumeNo = await select<number>({
    message: "查看某卷卷纲？",
    options: [
      ...volumes.map((v) => ({ value: v.content.volumeNo, label: `第 ${v.content.volumeNo} 卷 ${v.content.title}` })),
      { value: 0, label: "返回" },
    ],
  });
  if (volumeNo === 0) return;
  const volume = store.outlines.getActiveVolume(novelId, volumeNo);
  if (volume) section(`第 ${volumeNo} 卷卷纲`, formatVolumeOutline(volume.content));
}

async function chapterTextPanel(store: Store, novelId: string): Promise<void> {
  const chapters = store.chapters.list(novelId).filter((c) => c.status !== "planned");
  if (chapters.length === 0) {
    p.log.message("还没有写过章节");
    return;
  }
  const chapterNo = await select<number>({
    message: "查看哪一章？",
    options: chapters
      .slice()
      .reverse()
      .map((c) => ({
        value: c.chapterNo,
        label: `第 ${c.chapterNo} 章 ${c.title ?? ""}`,
        hint: c.status === "confirmed" ? "已确认" : "待确认",
      })),
  });
  const chapter = store.chapters.get(novelId, chapterNo)!;
  const draft = chapter.confirmedDraftId
    ? store.chapters.getDraft(chapter.confirmedDraftId)
    : store.chapters.latestDraft(chapter.id);
  if (!draft) {
    p.log.message("该章还没有正文");
    return;
  }
  section(`第 ${chapterNo} 章 ${chapter.title ?? ""}`, previewDraft(draft, 4000));
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
    options: characters.map((c) => ({
      value: c.id,
      label: c.name,
      hint: c.role === "protagonist" ? "主角" : c.role === "major" ? "主要" : "次要",
    })),
  });
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

async function versionPanel(store: Store, novelId: string): Promise<void> {
  const kind = await select<"foundation" | "setting" | "outline">({
    message: "查看哪类资产的版本？",
    options: [
      { value: "foundation", label: "基础盘" },
      { value: "setting", label: "设定" },
      { value: "outline", label: "大纲" },
    ],
  });

  if (kind === "outline") {
    const versions = store.outlines.listVersions(novelId, "main");
    section("总纲版本", formatVersions(versions.map((v) => ({ version: v.version, status: v.status, note: v.revisionNote, createdAt: v.createdAt }))));
    return;
  }
  const versions = store.assets.listVersions(novelId, kind);
  section(`${kind === "foundation" ? "基础盘" : "设定"}版本`, formatVersions(versions.map((v) => ({ version: v.version, status: v.status, createdAt: v.createdAt }))));
}

function formatVersions(
  versions: Array<{ version: number; status: string; note?: string; createdAt: string }>,
): string {
  if (versions.length === 0) return color.dim("暂无版本");
  return versions
    .map((v) => {
      const active = v.status === "active" ? color.green("● 生效") : color.dim("○ 历史");
      const date = v.createdAt.slice(0, 16).replace("T", " ");
      return `${active} v${v.version} ${color.dim(date)}${v.note ? `\n   ${color.dim(v.note)}` : ""}`;
    })
    .join("\n");
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
