export * from "./core/baseAgent.js";
export * from "./core/types.js";
export * from "./agents/chapter/index.js";
export * from "./agents/plan/index.js";
export * from "./agents/review/index.js";
export * from "./webnovelSkill/index.js";

export interface GeneratedOutlineResult {
  task: {
    taskId: string;
    novelId: string;
    title: string;
    workflowName: string;
    status: "queued" | "running" | "waiting_for_user" | "succeeded" | "failed" | "cancelled";
    inputSnapshot: string;
    outputSnapshot: string;
    error?: string;
    startedAt: string;
    finishedAt?: string;
  };
  outline: {
    novelId: string;
    logline: string;
    baseline: {
      hook: string;
      sellingPoint: string;
      mainConflict: string;
      storyEngine: string;
      endingDirection: string;
      synopsisExcerpt: string;
    };
    planningWindow: {
      currentVolume: string;
      currentStage: string;
      chapterRange: string;
      visibleChapterCount: number;
      totalPlannedChapters: number;
      contextBundle: string[];
      defaultFilters: string[];
    };
    masterOutline: {
      opening: string;
      mainGoal: string;
      escalation: string;
      climax: string;
      ending: string;
      protagonistArc: string;
      status: "草稿" | "待确认" | "已确认" | "需修订";
    };
    volumes: Array<{
      id: string;
      title: string;
      goal: string;
      conflict?: string;
      highlights?: string[];
      chapterRange?: string;
      status: "未开始" | "推进中" | "已完成";
    }>;
    timelineEvents: Array<{
      id: string;
      title: string;
      storyTime: string;
      narrativePosition: string;
      summary: string;
      characters: string[];
      causality: string;
      canon: boolean;
      risk?: string;
    }>;
    foreshadowing: Array<{
      id: string;
      title: string;
      plantedAt: string;
      payoffAt: string;
      status: "已埋设" | "推进中" | "待回收" | "已回收" | "风险";
      summary: string;
      relatedCharacters: string[];
      risk?: string;
    }>;
    issues: Array<{
      id: string;
      level: "健康" | "关注" | "风险";
      title: string;
      detail: string;
    }>;
    agentActions: Array<{
      id: string;
      title: string;
      description: string;
      workflowName: string;
    }>;
  };
  chapterPlans: Array<{
    id: string;
    novelId: string;
    chapterNo: number;
    title: string;
    volumeTitle: string;
    objective: string;
    hook: string;
    status: string;
  }>;
}

export async function runOutlinePlanningGraph(_input?: unknown): Promise<GeneratedOutlineResult> {
  throw new Error("首次大纲生成工作流尚未迁移到自有 Workflow 架构。");
}
