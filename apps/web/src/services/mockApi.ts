import {
  assets,
  chapterPlans,
  chapterWorkspaces,
  characters,
  novels,
  outlines,
  overviews,
  reviewReports,
  tasks,
} from "@/mocks/data";
import type {
  ChapterWorkspace,
  CharacterProfile,
  Novel,
  NovelAsset,
  NovelOverview,
  Outline,
  ReviewReport,
  TaskStatus,
  WorkflowTask,
} from "@/types";

const wait = async (ms = 120) => new Promise((resolve) => window.setTimeout(resolve, ms));

function assertFound<T>(value: T | undefined, message: string): T {
  if (!value) {
    throw new Error(message);
  }
  return value;
}

export async function listNovels(): Promise<Novel[]> {
  await wait();
  return novels;
}

export async function getNovelOverview(novelId: string): Promise<NovelOverview> {
  await wait();
  return assertFound(overviews.find((overview) => overview.novelId === novelId), "未找到小说概览");
}

export async function getNovelAssets(novelId: string): Promise<{
  assets: NovelAsset[];
  characters: CharacterProfile[];
}> {
  await wait();
  return {
    assets: assets.filter((asset) => asset.novelId === novelId),
    characters: characters.filter((character) => character.novelId === novelId),
  };
}

export async function getNovelOutline(novelId: string): Promise<{
  outline: Outline;
  chapterPlans: typeof chapterPlans;
}> {
  await wait();
  return {
    outline: assertFound(outlines.find((outline) => outline.novelId === novelId), "未找到大纲"),
    chapterPlans: chapterPlans.filter((plan) => plan.novelId === novelId),
  };
}

export async function getChapterWorkspace(novelId: string): Promise<ChapterWorkspace> {
  await wait();
  return assertFound(
    chapterWorkspaces.find((workspace) => workspace.novelId === novelId),
    "未找到章节工作区",
  );
}

export async function listNovelTasks(
  novelId: string,
  status: TaskStatus | "all" = "all",
): Promise<WorkflowTask[]> {
  await wait();
  const scopedTasks = tasks.filter((task) => task.novelId === novelId);
  return status === "all" ? scopedTasks : scopedTasks.filter((task) => task.status === status);
}

export async function getReviewReport(novelId: string): Promise<ReviewReport> {
  await wait();
  return assertFound(
    reviewReports.find((report) => report.novelId === novelId),
    "未找到评审报告",
  );
}

export async function retryTask(taskId: string): Promise<WorkflowTask> {
  await wait(180);
  const task = assertFound(tasks.find((item) => item.taskId === taskId), "未找到任务");
  return {
    ...task,
    status: "queued",
    error: undefined,
    outputSnapshot: "已重新加入本地任务队列。",
  };
}
