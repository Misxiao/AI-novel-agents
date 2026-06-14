import type { Store } from "@ai-novel-agents/store";

import type { NovelStatus } from "./status.js";

export type ActionKey =
  | "resume"
  | "foundation"
  | "setting"
  | "mainOutline"
  | "volumeOutline"
  | "confirm"
  | "write";

export interface Suggestion {
  action: ActionKey;
  label: string;
  chapterNo?: number;
  runId?: string;
}

/** 纯决策表：根据小说状态给出最合理的下一步 */
export function suggestNextStep(store: Store, status: NovelStatus): Suggestion {
  const interrupted = store.runs.findInterruptedRun(status.novel.id);
  if (interrupted) {
    return {
      action: "resume",
      runId: interrupted.id,
      label: `继续上次中断的流程（${interrupted.workflowId}）`,
    };
  }
  if (!status.hasFoundation) {
    return { action: "foundation", label: "生成小说基础盘" };
  }
  if (!status.hasSetting) {
    return { action: "setting", label: "生成世界观与设定" };
  }
  if (!status.hasMainOutline) {
    return { action: "mainOutline", label: "生成总纲" };
  }
  if (!status.hasCurrentVolumeOutline) {
    return {
      action: "volumeOutline",
      label: `生成第 ${status.currentVolumeNo} 卷卷纲`,
    };
  }
  if (status.reviewedChapterNos.length > 0) {
    const chapterNo = Math.min(...status.reviewedChapterNos);
    return { action: "confirm", chapterNo, label: `确认第 ${chapterNo} 章草稿` };
  }
  return {
    action: "write",
    chapterNo: status.nextChapterNo,
    label: `写作第 ${status.nextChapterNo} 章`,
  };
}
