import type { Store, Novel } from "@ai-novel-agents/store";

export interface NovelStatus {
  novel: Novel;
  hasFoundation: boolean;
  hasSetting: boolean;
  hasMainOutline: boolean;
  nextChapterNo: number;
  currentVolumeNo: number;
  hasCurrentVolumeOutline: boolean;
  confirmedCount: number;
  reviewedChapterNos: number[];
  openForeshadows: number;
  dueForeshadows: number;
  totalTokens: number;
}

export function gatherStatus(store: Store, novelId: string): NovelStatus {
  const novel = store.novels.get(novelId);
  if (!novel) {
    throw new Error(`未找到小说：${novelId}`);
  }
  const nextChapterNo = store.chapters.nextChapterNo(novelId);
  const main = store.outlines.getActiveMain(novelId);
  const currentVolumeNo = resolveCurrentVolume(store, novelId, nextChapterNo);

  return {
    novel,
    hasFoundation: !!store.assets.getActive(novelId, "foundation"),
    hasSetting: !!store.assets.getActive(novelId, "setting"),
    hasMainOutline: !!main,
    nextChapterNo,
    currentVolumeNo,
    hasCurrentVolumeOutline: !!store.outlines.getActiveVolume(novelId, currentVolumeNo),
    confirmedCount: store.chapters.listByStatus(novelId, "confirmed").length,
    reviewedChapterNos: store.chapters
      .listByStatus(novelId, "reviewed")
      .map((chapter) => chapter.chapterNo),
    openForeshadows: store.foreshadows.listOpen(novelId).length,
    dueForeshadows: store.foreshadows.listDue(novelId, nextChapterNo).length,
    totalTokens: store.runs.usageTotals(novelId).totalTokens,
  };
}

function resolveCurrentVolume(store: Store, novelId: string, chapterNo: number): number {
  for (const volume of store.outlines.listActiveVolumes(novelId)) {
    const { from, to } = volume.content.chapterRange;
    if (chapterNo >= from && chapterNo <= to) {
      return volume.content.volumeNo;
    }
  }
  const main = store.outlines.getActiveMain(novelId);
  if (main) {
    let cursor = 1;
    for (const volume of main.content.volumes) {
      cursor += Math.max(volume.estimatedChapters, 1);
      if (chapterNo < cursor) {
        return volume.volumeNo;
      }
    }
  }
  return 1;
}
