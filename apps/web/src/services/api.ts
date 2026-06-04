import type {
  ChapterPlan,
  ChapterWorkspace,
  CharacterProfile,
  Novel,
  NovelAsset,
  NovelCreationInput,
  NovelOverview,
  Outline,
  OutlineGenerationResult,
  ReviewReport,
  TaskStatus,
  WorkflowTask,
} from "@/types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

interface ApiErrorPayload {
  message?: string;
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, init);
  const payload = await response.json().catch(() => null) as ApiErrorPayload | T | null;

  if (!response.ok) {
    throw new Error((payload as ApiErrorPayload | null)?.message ?? "请求失败");
  }

  return payload as T;
}

export async function listNovels(): Promise<Novel[]> {
  const payload = await requestJson<{ novels: Novel[] }>("/api/novels");
  return payload.novels;
}

export async function getNovelOverview(novelId: string): Promise<NovelOverview> {
  return requestJson<NovelOverview>(`/api/novels/${novelId}/overview`);
}

export async function getNovelAssets(novelId: string): Promise<{
  assets: NovelAsset[];
  characters: CharacterProfile[];
}> {
  return requestJson(`/api/novels/${novelId}/assets`);
}

export async function getNovelOutline(novelId: string): Promise<{
  outline: Outline;
  chapterPlans: ChapterPlan[];
}> {
  const response = await fetch(`${apiBaseUrl}/api/novels/${novelId}/outline`);
  const payload = await response.json().catch(() => null) as
    | OutlineGenerationResult
    | { status: "pending"; novel: Novel; message: string }
    | ApiErrorPayload
    | null;

  if (response.status === 202 && payload && "status" in payload && payload.status === "pending") {
    return {
      outline: buildPendingOutline(payload.novel),
      chapterPlans: [],
    };
  }

  if (!response.ok) {
    throw new Error((payload as ApiErrorPayload | null)?.message ?? "大纲加载失败");
  }

  const result = payload as OutlineGenerationResult;
  return {
    outline: result.outline,
    chapterPlans: result.chapterPlans,
  };
}

export async function generateFirstOutline(novelId: string): Promise<OutlineGenerationResult> {
  return requestJson(`/api/novels/${novelId}/outlines/generate-first`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chapterPlanCount: 10,
    }),
  });
}

export async function updateNovel(
  novelId: string,
  input: Partial<Pick<Novel, "title" | "genre" | "hook">>,
): Promise<Novel> {
  return requestJson(`/api/novels/${novelId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function saveNovelOutline(novelId: string, outline: Outline): Promise<OutlineGenerationResult> {
  return requestJson(`/api/novels/${novelId}/outline`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ outline }),
  });
}

export async function reviseNovelOutline(
  novelId: string,
  input: {
    scope: "master" | "volume";
    instruction: string;
    volumeId?: string;
  },
): Promise<OutlineGenerationResult> {
  return requestJson(`/api/novels/${novelId}/outline/revise`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input),
  });
}

export async function getChapterWorkspace(novelId: string): Promise<ChapterWorkspace> {
  return requestJson(`/api/novels/${novelId}/chapter-workspace`);
}

export async function listNovelTasks(
  novelId: string,
  status: TaskStatus | "all" = "all",
): Promise<WorkflowTask[]> {
  const query = status === "all" ? "" : `?status=${encodeURIComponent(status)}`;
  const payload = await requestJson<{ tasks: WorkflowTask[] }>(`/api/novels/${novelId}/tasks${query}`);
  return payload.tasks;
}

export async function getReviewReport(novelId: string): Promise<ReviewReport> {
  return requestJson(`/api/novels/${novelId}/review-report`);
}

export async function retryTask(taskId: string): Promise<WorkflowTask> {
  return requestJson(`/api/tasks/${taskId}/retry`, {
    method: "POST",
  });
}

export async function createNovelProject(input: NovelCreationInput): Promise<Novel> {
  return requestJson("/api/novels", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      title: input.title,
      genre: input.genre,
      seedIdea: input.seedIdea,
      targetWords: input.targetWords,
    }),
  });
}

function buildPendingOutline(novel: Novel): Outline {
  return {
    novelId: novel.novelId,
    logline: novel.hook,
    baseline: {
      hook: novel.hook,
      sellingPoint: "等待首次大纲生成核心卖点。",
      mainConflict: "等待首次大纲生成主冲突。",
      storyEngine: "等待首次大纲生成故事引擎。",
      endingDirection: "等待首次大纲生成结局方向。",
      synopsisExcerpt: "首次大纲尚未生成。",
    },
    planningWindow: {
      currentVolume: novel.currentVolume,
      currentStage: "待生成",
      chapterRange: "待生成",
      visibleChapterCount: 0,
      totalPlannedChapters: novel.totalChapters,
      contextBundle: ["小说想法", "预计字数", "题材方向"],
      defaultFilters: ["待生成"],
    },
    masterOutline: {
      opening: "等待生成。",
      mainGoal: "等待生成。",
      escalation: "等待生成。",
      climax: "等待生成。",
      ending: "等待生成。",
      protagonistArc: "等待生成。",
      status: "草稿",
    },
    volumes: [],
    timelineEvents: [],
    foreshadowing: [],
    issues: [],
    agentActions: [
      {
        id: `${novel.novelId}-generate-first-outline`,
        title: "生成首次大纲",
        description: "基于创建时的想法和预计字数生成总纲、分卷和前几章章纲。",
        workflowName: "outline-planning-graph",
      },
    ],
  };
}
