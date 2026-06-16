import type { AppContext } from "../context.js";
import { gatherStatus } from "../status.js";
import { section } from "../render/section.js";
import { color, formatTokens } from "../util.js";

/** 只读进度面板：阶段 / 卷章进度 / 字数 / 伏笔 / token */
export function progressPanel(ctx: AppContext): void {
  const { store, currentNovelId: novelId } = ctx;
  const status = gatherStatus(store, novelId);

  const confirmed = store.chapters.listByStatus(novelId, "confirmed");
  const totalWords = confirmed.reduce((sum, chapter) => {
    const draft = chapter.confirmedDraftId ? store.chapters.getDraft(chapter.confirmedDraftId) : undefined;
    return sum + (draft?.wordCount ?? 0);
  }, 0);

  const stage = !status.hasFoundation
    ? "待立项"
    : !status.hasMainOutline
      ? "筹备大纲"
      : "连载中";

  const lines = [
    `${color.bold("阶段")}：${stage}`,
    `${color.bold("当前")}：第 ${status.currentVolumeNo} 卷 · 下一章 第 ${status.nextChapterNo} 章`,
    `${color.bold("进度")}：已确认 ${status.confirmedCount} 章 · 约 ${(totalWords / 10000).toFixed(1)} 万字`,
    `${color.bold("待确认草稿")}：${status.reviewedChapterNos.length}`,
    `${color.bold("伏笔")}：未回收 ${status.openForeshadows}（其中窗口已到 ${status.dueForeshadows}）`,
    `${color.bold("累计")}：${formatTokens(status.totalTokens)} tokens`,
  ];

  const volumes = store.outlines.listActiveVolumes(novelId);
  if (volumes.length > 0) {
    lines.push(color.cyan("各卷进度："));
    for (const volume of volumes) {
      const { from, to } = volume.content.chapterRange;
      const done = confirmed.filter((c) => c.chapterNo >= from && c.chapterNo <= to).length;
      lines.push(`  第 ${volume.content.volumeNo} 卷《${volume.content.title}》 ${done}/${to - from + 1} 章`);
    }
  }

  section(`《${status.novel.title}》进度`, lines.join("\n"));
}
