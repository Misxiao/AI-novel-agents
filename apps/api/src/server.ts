import cors from "@fastify/cors";
import dotenv from "dotenv";
import Fastify from "fastify";

import { runOutlinePlanningGraph, type GeneratedOutlineResult } from "../../../packages/agents/src/index.js";
import {
  NovelDatabase,
  type CreateNovelInput,
  type StoredChapterPlan,
  type StoredNovel,
  type TaskStatus,
  type UpdateNovelInput,
} from "../../../packages/db/src/index.js";
import { createDefaultChatModel, LlmConfigurationError, LlmProviderError } from "../../../packages/llm/src/index.js";

dotenv.config({ path: new URL("../../../.env", import.meta.url) });

interface CreateNovelBody {
  title?: string;
  genre?: string;
  seedIdea?: string;
  targetWords?: number;
}

interface GenerateFirstOutlineBody {
  chapterPlanCount?: number;
}

interface UpdateNovelBody {
  title?: string;
  hook?: string;
  genre?: string;
}

interface SaveOutlineBody {
  outline?: GeneratedOutlineResult["outline"];
}

interface ReviseOutlineBody {
  scope?: "master" | "volume";
  instruction?: string;
  volumeId?: string;
}

const db = new NovelDatabase(process.env.DB_PATH);

const server = Fastify({
  logger: true,
});

await server.register(cors, {
  origin: true,
});

server.get("/api/health", async () => ({
  ok: true,
  service: "AI Novel Agents API",
  time: new Date().toISOString(),
}));

server.get("/api/novels", async () => ({
  novels: db.listNovels().map(toApiNovel),
}));

server.get<{ Params: { novelId: string } }>("/api/novels/:novelId", async (request, reply) => {
  const novel = db.getNovel(request.params.novelId);
  if (!novel) {
    return reply.code(404).send({
      error: "novel_not_found",
      message: "未找到小说项目。",
    });
  }

  return toApiNovel(novel);
});

server.post<{ Body: CreateNovelBody }>("/api/novels", async (request, reply) => {
  const body = request.body;
  const seedIdea = body?.seedIdea?.trim();
  const targetWords = Number(body?.targetWords);

  if (!seedIdea) {
    return reply.code(400).send({
      error: "invalid_seed_idea",
      message: "请先填写小说想法。",
    });
  }

  if (!Number.isFinite(targetWords) || targetWords <= 0) {
    return reply.code(400).send({
      error: "invalid_target_words",
      message: "预计字数必须大于 0。",
    });
  }

  const novel = db.createNovel({
    title: body.title,
    genre: body.genre,
    seedIdea,
    targetWords,
  } satisfies CreateNovelInput);

  return reply.code(201).send(toApiNovel(novel));
});

server.patch<{ Params: { novelId: string }; Body: UpdateNovelBody }>("/api/novels/:novelId", async (request, reply) => {
  const novel = db.updateNovel(request.params.novelId, {
    title: request.body?.title,
    hook: request.body?.hook,
    genre: request.body?.genre,
  } satisfies UpdateNovelInput);

  if (!novel) {
    return reply.code(404).send({
      error: "novel_not_found",
      message: "未找到小说项目。",
    });
  }

  return toApiNovel(novel);
});

server.get<{ Params: { novelId: string } }>("/api/novels/:novelId/outline", async (request, reply) => {
  const novel = db.getNovel(request.params.novelId);
  if (!novel) {
    return reply.code(404).send({
      error: "novel_not_found",
      message: "未找到小说项目。",
    });
  }

  const generated = db.getOutlineResult<GeneratedOutlineResult["outline"]>(request.params.novelId);
  if (!generated) {
    return reply.code(202).send({
      status: "pending",
      novel: toApiNovel(novel),
      message: "当前小说尚未生成首次大纲。",
    });
  }

  return generated;
});

server.patch<{ Params: { novelId: string }; Body: SaveOutlineBody }>("/api/novels/:novelId/outline", async (request, reply) => {
  const novel = db.getNovel(request.params.novelId);
  if (!novel) {
    return reply.code(404).send({
      error: "novel_not_found",
      message: "未找到小说项目。",
    });
  }

  const outline = request.body?.outline;
  if (!outline || outline.novelId !== novel.novelId) {
    return reply.code(400).send({
      error: "invalid_outline",
      message: "大纲数据无效或 novelId 不匹配。",
    });
  }

  return db.saveOutlineOnly(novel.novelId, outline, "已保存大纲修改。");
});

server.post<{ Params: { novelId: string }; Body: ReviseOutlineBody }>("/api/novels/:novelId/outline/revise", async (request, reply) => {
  const novel = db.getNovel(request.params.novelId);
  if (!novel) {
    return reply.code(404).send({
      error: "novel_not_found",
      message: "未找到小说项目。",
    });
  }

  const generated = db.getOutlineResult<GeneratedOutlineResult["outline"]>(novel.novelId);
  if (!generated) {
    return reply.code(409).send({
      error: "outline_missing",
      message: "当前小说尚未生成大纲，无法修改。",
    });
  }

  const instruction = request.body?.instruction?.trim();
  if (!instruction) {
    return reply.code(400).send({
      error: "invalid_instruction",
      message: "请先填写修改想法。",
    });
  }

  const outline = applyOutlineRevision(generated.outline, {
    scope: request.body?.scope ?? "master",
    volumeId: request.body?.volumeId,
    instruction,
  });

  return db.saveOutlineOnly(novel.novelId, outline, `已根据修改想法生成大纲草案：${instruction}`);
});

server.get<{ Params: { novelId: string } }>("/api/novels/:novelId/overview", async (request, reply) => {
  const novel = db.getNovel(request.params.novelId);
  if (!novel) {
    return reply.code(404).send({
      error: "novel_not_found",
      message: "未找到小说项目。",
    });
  }

  const generated = db.getOutlineResult<GeneratedOutlineResult["outline"]>(novel.novelId);
  return buildNovelOverview(novel, generated?.outline, generated?.chapterPlans ?? []);
});

server.get<{ Params: { novelId: string } }>("/api/novels/:novelId/assets", async (request, reply) => {
  const novel = db.getNovel(request.params.novelId);
  if (!novel) {
    return reply.code(404).send({
      error: "novel_not_found",
      message: "未找到小说项目。",
    });
  }

  const generated = db.getOutlineResult<GeneratedOutlineResult["outline"]>(novel.novelId);
  return buildNovelAssets(novel, generated?.outline);
});

server.get<{ Params: { novelId: string } }>("/api/novels/:novelId/chapter-workspace", async (request, reply) => {
  const novel = db.getNovel(request.params.novelId);
  if (!novel) {
    return reply.code(404).send({
      error: "novel_not_found",
      message: "未找到小说项目。",
    });
  }

  const generated = db.getOutlineResult<GeneratedOutlineResult["outline"]>(novel.novelId);
  const plan = generated?.chapterPlans[0];
  if (!plan) {
    return reply.code(409).send({
      error: "chapter_plan_missing",
      message: "当前小说还没有章纲，请先生成首次大纲。",
    });
  }

  return buildChapterWorkspace(plan);
});

server.get<{ Params: { novelId: string }; Querystring: { status?: string } }>(
  "/api/novels/:novelId/tasks",
  async (request, reply) => {
    const novel = db.getNovel(request.params.novelId);
    if (!novel) {
      return reply.code(404).send({
        error: "novel_not_found",
        message: "未找到小说项目。",
      });
    }

    const status = normalizeTaskStatus(request.query.status);
    if (request.query.status && request.query.status !== "all" && !status) {
      return reply.code(400).send({
        error: "invalid_task_status",
        message: "任务状态筛选值无效。",
      });
    }

    return {
      tasks: db.listTasks(novel.novelId, status),
    };
  },
);

server.post<{ Params: { taskId: string } }>("/api/tasks/:taskId/retry", async (request, reply) => {
  const task = db.getTask(request.params.taskId);
  if (!task) {
    return reply.code(404).send({
      error: "task_not_found",
      message: "未找到任务。",
    });
  }

  if (task.status !== "failed") {
    return reply.code(409).send({
      error: "task_not_failed",
      message: "只有失败任务可以重试。",
    });
  }

  return db.queueTaskRetry(task.taskId);
});

server.get<{ Params: { novelId: string } }>("/api/novels/:novelId/review-report", async (request, reply) => {
  const novel = db.getNovel(request.params.novelId);
  if (!novel) {
    return reply.code(404).send({
      error: "novel_not_found",
      message: "未找到小说项目。",
    });
  }

  const generated = db.getOutlineResult<GeneratedOutlineResult["outline"]>(novel.novelId);
  return buildReviewReport(novel, generated?.chapterPlans[0]);
});

server.post<{ Params: { novelId: string }; Body: GenerateFirstOutlineBody }>(
  "/api/novels/:novelId/outlines/generate-first",
  async (request, reply) => {
    const novel = db.getNovel(request.params.novelId);
    if (!novel) {
      return reply.code(404).send({
        error: "novel_not_found",
        message: "未找到小说项目，无法生成首次大纲。",
      });
    }

    try {
      const model = createDefaultChatModel();
      const result = await runOutlinePlanningGraph({
        model,
        novel: {
          novelId: novel.novelId,
          title: novel.title,
          genre: novel.genre,
          hook: novel.hook,
          targetReaders: novel.targetReaders,
          totalChapters: novel.totalChapters,
          currentVolume: novel.currentVolume,
        },
        source: buildInitialOutlineSource(novel),
        chapterPlanCount: request.body?.chapterPlanCount,
      });
      db.saveOutlineResult(result);
      return result;
    } catch (error) {
      request.log.error(error);
      if (error instanceof LlmConfigurationError) {
        return reply.code(500).send({
          error: "llm_configuration_error",
          message: error.message,
        });
      }
      if (error instanceof LlmProviderError) {
        return reply.code(error.status ?? 502).send({
          error: "llm_provider_error",
          message: error.message,
          provider: error.provider,
        });
      }
      return reply.code(500).send({
        error: "outline_generation_failed",
        message: error instanceof Error ? error.message : "首次大纲生成失败。",
      });
    }
  },
);

const port = Number(process.env.API_PORT ?? 4100);
const host = process.env.API_HOST ?? "0.0.0.0";

try {
  await server.listen({ port, host });
} catch (error) {
  server.log.error(error);
  process.exit(1);
}

function toApiNovel(novel: StoredNovel) {
  return {
    novelId: novel.novelId,
    title: novel.title,
    genre: novel.genre,
    stage: novel.stage,
    hook: novel.hook,
    targetReaders: novel.targetReaders,
    totalChapters: novel.totalChapters,
    completedChapters: novel.completedChapters,
    qualityScore: novel.qualityScore,
    qualityState: novel.qualityState,
    archived: novel.archived,
    updatedAt: novel.updatedAt,
    recentTask: novel.recentTask,
    currentVolume: novel.currentVolume,
    targetWords: novel.targetWords,
  };
}

function buildNovelOverview(
  novel: StoredNovel,
  outline?: GeneratedOutlineResult["outline"],
  chapterPlans: StoredChapterPlan[] = [],
) {
  const chapterProgress = Math.round((novel.completedChapters / novel.totalChapters) * 100);
  const hasOutline = Boolean(outline?.volumes.length || chapterPlans.length);
  const styleKeywords = outline?.baseline ? inferStyleKeywords(novel.genre) : inferStyleKeywords(novel.genre);

  return {
    novelId: novel.novelId,
    premise: outline?.logline ?? novel.hook,
    creativeSynopsis:
      outline?.baseline.synopsisExcerpt ??
      `围绕「${novel.hook}」建立长篇创作基准，预计 ${formatWanWords(novel.targetWords)} 字。`,
    publicSynopsis: outline?.baseline.hook ?? novel.hook,
    pitch: {
      sellingPoint: outline?.baseline.sellingPoint ?? "等待首次大纲生成后形成核心卖点。",
      emotionalPromise: buildEmotionalPromise(novel.genre),
      mainConflict: outline?.baseline.mainConflict ?? "等待首次大纲生成后明确主冲突。",
      storyEngine: outline?.baseline.storyEngine ?? "等待首次大纲生成后明确故事引擎。",
      protagonistArc: outline?.masterOutline.protagonistArc ?? "等待首次大纲生成后明确主角成长线。",
      riskNote: hasOutline ? "已生成初版结构，后续需要人工确认后再进入正文生产。" : "缺少总纲和章纲，暂不适合进入正文生产。",
    },
    styleDirection: {
      keywords: styleKeywords,
      pacing: novel.genre.includes("悬疑") ? "短节奏推进，保留线索空白。" : "按章末钩子和阶段升级稳定推进。",
      narration: "第三人称有限视角，优先服务角色行动和冲突升级。",
      dialogueDensity: "中等偏高，对白承担关系变化和信息推进。",
      forbiddenPatterns: ["空泛抒情", "重复解释设定", "脱离 novelId 的跨书记忆"],
    },
    assetReadiness: [
      {
        id: `${novel.novelId}-readiness-foundation`,
        label: "立项基础",
        status: "ready",
        note: "已保存小说名称、题材、初始想法和预计体量。",
      },
      {
        id: `${novel.novelId}-readiness-outline`,
        label: "总纲与章纲",
        status: hasOutline ? "draft" : "missing",
        note: hasOutline ? "已生成初版大纲，等待人工确认。" : "尚未生成首次大纲。",
      },
      {
        id: `${novel.novelId}-readiness-memory`,
        label: "小说记忆",
        status: novel.completedChapters > 0 ? "draft" : "missing",
        note: novel.completedChapters > 0 ? "已有章节进度，可逐步沉淀 canon。" : "尚无确认正文，canon 记忆未开始沉淀。",
      },
    ],
    chapterProgress,
    memoryHealth: novel.completedChapters > 0 ? 60 : 20,
    currentGoal: outline?.volumes[0]?.goal ?? "先完成首次大纲生成，建立总纲、分卷和前 10 章章纲。",
    nextMilestone: hasOutline ? "确认总纲与第一卷目标。" : "生成首次大纲。",
    pendingItems: [
      {
        id: `${novel.novelId}-pending-outline`,
        title: hasOutline ? "人工确认首次大纲" : "生成首次大纲",
        priority: "高",
        owner: "outline",
      },
      {
        id: `${novel.novelId}-pending-memory`,
        title: "建立小说独立记忆基线",
        priority: "中",
        owner: "memory",
      },
    ],
    metrics: [
      { label: "计划章节", value: `${novel.totalChapters}`, trend: `${formatWanWords(novel.targetWords)} 字目标` },
      { label: "章纲数量", value: `${chapterPlans.length}`, trend: hasOutline ? "已写入 SQLite" : "待生成" },
      { label: "任务记录", value: `${db.listTasks(novel.novelId).length}`, trend: "仅统计当前小说" },
    ],
  };
}

function buildNovelAssets(novel: StoredNovel, outline?: GeneratedOutlineResult["outline"]) {
  const now = novel.updatedAt;
  const assets = [
    {
      id: `${novel.novelId}-asset-foundation`,
      novelId: novel.novelId,
      kind: "world",
      title: "立项基础",
      summary: outline?.baseline.mainConflict ?? novel.hook,
      tags: [novel.genre, "本地资产", "novelId隔离"],
      updatedAt: now,
    },
    {
      id: `${novel.novelId}-asset-style`,
      novelId: novel.novelId,
      kind: "style",
      title: "风格方向",
      summary: inferStyleKeywords(novel.genre).join("、"),
      tags: inferStyleKeywords(novel.genre),
      updatedAt: now,
    },
    ...(outline?.foreshadowing ?? []).map((item) => ({
      id: item.id,
      novelId: novel.novelId,
      kind: "foreshadowing",
      title: item.title,
      summary: item.summary,
      tags: [item.status, item.plantedAt, item.payoffAt],
      updatedAt: now,
    })),
  ];

  return {
    assets,
    characters: [],
  };
}

function buildChapterWorkspace(plan: StoredChapterPlan) {
  const now = new Date().toISOString();
  return {
    novelId: plan.novelId,
    plan,
    draft: {
      id: `${plan.id}-draft-empty`,
      novelId: plan.novelId,
      chapterPlanId: plan.id,
      version: 1,
      wordCount: 0,
      body: "",
      updatedAt: now,
    },
    reviewSummary: "当前章节尚未生成正文或评审报告。",
    versionNotes: ["v1：已从章纲创建空白正文工作区。"],
  };
}

function buildReviewReport(novel: StoredNovel, plan?: StoredChapterPlan) {
  return {
    id: `${novel.novelId}-review-empty`,
    novelId: novel.novelId,
    chapterNo: plan?.chapterNo ?? 0,
    chapterTitle: plan?.title ?? "尚未生成章纲",
    overallScore: 0,
    conclusion: plan ? "当前章节尚未产生真实评审报告。" : "请先生成首次大纲和章纲，再进入章节评审。",
    dimensions: [
      {
        label: "剧情逻辑",
        score: 0,
        level: "关注",
        comment: "暂无正文评审结果。",
      },
      {
        label: "角色一致性",
        score: 0,
        level: "关注",
        comment: "暂无正文评审结果。",
      },
      {
        label: "章末拉力",
        score: 0,
        level: "关注",
        comment: "暂无正文评审结果。",
      },
    ],
    recommendations: plan
      ? ["生成章节正文后再触发评审工作流。", "评审报告必须绑定当前 novelId 和 chapterPlanId。", "未确认草稿不得写入 canon。"]
      : ["先生成首次大纲。", "确认章纲后再进入正文生产。", "评审报告不会使用任何示例小说数据。"],
  };
}

function applyOutlineRevision(
  outline: GeneratedOutlineResult["outline"],
  input: {
    scope: "master" | "volume";
    volumeId?: string;
    instruction: string;
  },
): GeneratedOutlineResult["outline"] {
  const issue = {
    id: `${outline.novelId}-revision-issue-${Date.now()}`,
    level: "关注" as const,
    title: input.scope === "volume" ? "分卷修改草案待确认" : "总纲修改草案待确认",
    detail: input.instruction,
  };

  if (input.scope === "volume") {
    return {
      ...outline,
      masterOutline: {
        ...outline.masterOutline,
        status: outline.masterOutline.status === "已确认" ? "需修订" : outline.masterOutline.status,
      },
      volumes: outline.volumes.map((volume) => {
        if (volume.id !== input.volumeId) {
          return volume;
        }
        return {
          ...volume,
          goal: appendRevision(volume.goal, input.instruction),
          highlights: Array.from(new Set([...(volume.highlights ?? []), "修改草案"])),
        };
      }),
      issues: [issue, ...outline.issues].slice(0, 10),
    };
  }

  return {
    ...outline,
    masterOutline: {
      ...outline.masterOutline,
      escalation: appendRevision(outline.masterOutline.escalation, input.instruction),
      status: "需修订",
    },
    issues: [issue, ...outline.issues].slice(0, 10),
  };
}

function appendRevision(current: string, instruction: string) {
  const suffix = `修改草案：${instruction}`;
  if (current.includes(suffix)) {
    return current;
  }
  return `${current}\n${suffix}`;
}

function normalizeTaskStatus(status?: string): TaskStatus | undefined {
  if (
    status === "queued" ||
    status === "running" ||
    status === "waiting_for_user" ||
    status === "succeeded" ||
    status === "failed" ||
    status === "cancelled"
  ) {
    return status;
  }
  return undefined;
}

function buildEmotionalPromise(genre: string) {
  if (genre.includes("悬疑")) return "层层逼近真相，在反转中获得掌控感。";
  if (genre.includes("女频")) return "在关系拉扯和自我选择中完成成长。";
  if (genre.includes("科幻")) return "用理性和代价面对更大尺度的危机。";
  if (genre.includes("历史")) return "在时代压力中做出艰难选择并改变局势。";
  return "通过持续升级、破局和阶段胜利获得爽感。";
}

function buildInitialOutlineSource(novel: StoredNovel) {
  return {
    logline: novel.hook,
    baseline: {
      hook: novel.hook,
      sellingPoint: `${novel.genre}方向，围绕初始灵感提炼可连续升级的核心卖点。`,
      mainConflict: "主角目标、外部阻力与阶段性代价待通过首次大纲生成明确。",
      storyEngine: "围绕卷目标、阶段章纲、人物变化和伏笔回收持续推进。",
      endingDirection: "结局方向待首次大纲生成后确认。",
      synopsisExcerpt: `预计 ${formatWanWords(novel.targetWords)} 字，约 ${novel.totalChapters} 章。`,
    },
    styleKeywords: inferStyleKeywords(novel.genre),
  };
}

function formatWanWords(targetWords: number) {
  return targetWords >= 10000 ? `${Math.round(targetWords / 10000)} 万` : `${targetWords}`;
}

function inferStyleKeywords(genre: string) {
  if (genre.includes("悬疑")) return ["短章强钩子", "线索回收", "克制解释"];
  if (genre.includes("科幻")) return ["设定可信", "危机递进", "冷静叙述"];
  if (genre.includes("女频")) return ["情绪细腻", "关系张力", "节奏稳定"];
  if (genre.includes("历史")) return ["时代细节", "权谋递进", "群像清晰"];
  return ["强升级", "卷末爆点", "体系清晰"];
}
