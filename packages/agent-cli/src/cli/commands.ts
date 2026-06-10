import type {
  InitialOutlineDraft,
  ChatModel,
} from "../../../agents/src/index.js";
import type {
  PreflightAssetKind,
  TaskStatus,
  UpdateNovelInput,
} from "../../../db/src/index.js";
import {
  runNovelPreflightWorkflow,
  runConfirmOutlineWorkflow,
  runReviseMasterOutlineWorkflow,
  runReviseVolumeOutlineWorkflow,
  runWriteNextChapterWorkflow,
  type OutlineRevisionVersion,
} from "../../../workflow/src/index.js";
import {
  displayNovelTitle,
  readBooleanOption,
  readIntegerOption,
  readStringOption,
  requireNovel,
  resolveNovelId,
} from "./commandUtils.js";
import { CliUsageError } from "./errors.js";
import { CommandRegistry } from "./registry.js";
import type {
  CliCommandContext,
  CommandDefinition,
  ParsedCommand,
} from "./types.js";

export function createCommandRegistry() {
  const registry = new CommandRegistry();
  for (const definition of createCoreCommands(registry)) {
    registry.register(definition);
  }
  for (const definition of createNovelCommands()) {
    registry.register(definition);
  }
  for (const definition of createWorkspaceQueryCommands()) {
    registry.register(definition);
  }
  for (const definition of createWorkflowCommands()) {
    registry.register(definition);
  }
  return registry;
}

function createCoreCommands(registry: CommandRegistry): CommandDefinition[] {
  return [
    define(["help"], "查看全部命令或某条命令说明", "help [command]", ["help", "help novel list"], async (_context, command) => ({
      exitCode: 0,
      lines: [registry.buildHelp(command.positionals)],
    }), { maxPositionals: 2 }),
    define(["context"], "查看当前小说和数据库位置", "context", ["context"], async (context) => {
      const novel = context.session.activeNovelId
        ? context.services.workspace.getNovel(context.session.activeNovelId)
        : null;
      return {
        exitCode: 0,
        data: {
          activeNovelId: novel?.novelId,
          activeNovelTitle: novel ? displayNovelTitle(novel) : undefined,
          dbPath: context.dbPath,
        },
        lines: [
          `当前小说: ${novel ? `${displayNovelTitle(novel)} (${novel.novelId})` : "未选择"}`,
          `数据库: ${context.dbPath}`,
        ],
      };
    }),
    define(["exit"], "退出交互工作台", "exit", ["exit"], async () => ({
      exitCode: 0,
      shouldExit: true,
    })),
    define(["quit"], "退出交互工作台", "quit", ["quit"], async () => ({
      exitCode: 0,
      shouldExit: true,
    })),
  ];
}

function createNovelCommands(): CommandDefinition[] {
  return [
    define(["novel", "list"], "查看小说列表", "novel list [--json]", ["novel list", "novel list --json"], async (context) => {
      const novels = context.services.workspace.listNovels();
      return {
        exitCode: 0,
        data: novels,
        lines: novels.length === 0
          ? ["暂无小说。使用 novel create 创建空小说。"]
          : [
              "小说列表:",
              ...novels.map((novel) => [
                context.session.activeNovelId === novel.novelId ? "*" : " ",
                novel.novelId,
                displayNovelTitle(novel),
                novel.stage,
                `${novel.completedChapters}/${novel.totalChapters}`,
              ].join("  ")),
            ],
      };
    }),
    define(["novel", "create"], "创建空小说", "novel create [--json]", ["novel create"], async (context) => {
      const novel = context.services.workspace.createEmptyNovel();
      if (context.interactive) {
        context.session.activeNovelId = novel.novelId;
      } else {
        context.session.activeNovelId = novel.novelId;
      }
      return {
        exitCode: 0,
        data: novel,
        lines: [
          `已创建空小说：${novel.novelId}`,
          "当前小说已切换到该项目。",
        ],
      };
    }),
    define(["novel", "show"], "查看小说详情", "novel show [novelId] [--novel-id <id>] [--json]", ["novel show", "novel show novel-123"], async (context, command) => {
      const novelId = resolveNovelId(context, command, command.positionals[0]);
      const novel = requireNovel(context, novelId);
      return {
        exitCode: 0,
        data: novel,
        lines: formatNovel(novel),
      };
    }, { maxPositionals: 1 }),
    define(["novel", "use"], "切换当前小说", "novel use <novelId>", ["novel use novel-123"], async (context, command) => {
      const novelId = command.positionals[0];
      if (!novelId) {
        throw new CliUsageError("必须提供 novelId。");
      }
      const novel = requireNovel(context, novelId);
      context.session.activeNovelId = novel.novelId;
      return {
        exitCode: 0,
        data: novel,
        lines: [`当前小说：${displayNovelTitle(novel)} (${novel.novelId})`],
      };
    }, { maxPositionals: 1 }),
    define(["novel", "update"], "修改小说基础信息", "novel update [--title <标题>] [--genre <题材>] [--hook <钩子>] [--novel-id <id>] [--json]", ["novel update --title 裂界回声", 'novel update --hook "主角必须在失忆前关闭裂界"'], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      requireNovel(context, novelId);
      const update: UpdateNovelInput = {
        title: readStringOption(command, "title"),
        genre: readStringOption(command, "genre"),
        hook: readStringOption(command, "hook"),
      };
      if (!update.title && !update.genre && !update.hook) {
        if (!context.interactive) {
          throw new CliUsageError("至少传入 --title、--genre 或 --hook 中的一项。");
        }
        const title = (await context.io.question("标题（留空保持不变）：")).trim();
        const genre = (await context.io.question("题材（留空保持不变）：")).trim();
        const hook = (await context.io.question("核心钩子（留空保持不变）：")).trim();
        update.title = title || undefined;
        update.genre = genre || undefined;
        update.hook = hook || undefined;
      }
      const novel = context.services.workspace.updateNovel(novelId, update);
      if (!novel) {
        throw new Error(`小说更新失败：${novelId}`);
      }
      return {
        exitCode: 0,
        data: novel,
        lines: ["小说基础信息已更新。", ...formatNovel(novel)],
      };
    }),
  ];
}

function createWorkspaceQueryCommands(): CommandDefinition[] {
  return [
    define(["asset", "show"], "查看前置资产草案", "asset show [foundation|setting|outline|all] [--novel-id <id>] [--json]", ["asset show all", "asset show outline --json"], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      requireNovel(context, novelId);
      const requested = command.positionals[0] ?? "all";
      const allowed = new Set(["foundation", "setting", "outline", "all"]);
      if (!allowed.has(requested)) {
        throw new CliUsageError(`未知资产类型：${requested}`);
      }
      const kinds: PreflightAssetKind[] = requested === "all"
        ? ["foundation", "setting", "outline"]
        : [requested as PreflightAssetKind];
      const assets = Object.fromEntries(
        kinds.map((kind) => [kind, context.services.workspace.getDraft(novelId, kind)]),
      );
      return {
        exitCode: 0,
        data: requested === "all" ? assets : assets[requested],
        lines: kinds.flatMap((kind) => {
          const asset = assets[kind];
          return asset
            ? [
                `${kind}: ${asset.status}，更新时间 ${asset.updatedAt}`,
                JSON.stringify(asset.asset, null, 2),
              ]
            : [`${kind}: 暂无草案`];
        }),
      };
    }, { maxPositionals: 1 }),
    define(["outline", "show"], "查看当前或指定版本大纲", "outline show [--version-id <id>] [--novel-id <id>] [--json]", ["outline show", "outline show --version-id outline-version-123"], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      requireNovel(context, novelId);
      const versionId = readStringOption(command, "version-id");
      if (versionId) {
        const stored = context.services.workspace.getOutlineVersion<OutlineRevisionVersion>(
          novelId,
          versionId,
        );
        if (!stored) {
          throw new Error(`未找到大纲版本：${versionId}`);
        }
        return {
          exitCode: 0,
          data: stored.version.revisedOutline,
          lines: [
            `大纲版本: ${stored.versionId} / ${stored.status}`,
            JSON.stringify(stored.version.revisedOutline, null, 2),
          ],
        };
      }
      const latest = context.services.workspace.getLatestOutlineVersion<OutlineRevisionVersion>(
        novelId,
      );
      if (latest) {
        return {
          exitCode: 0,
          data: latest.version.revisedOutline,
          lines: [
            `最新候选版本: ${latest.versionId} / ${latest.status}`,
            JSON.stringify(latest.version.revisedOutline, null, 2),
          ],
        };
      }
      const draft = context.services.workspace.getDraft(novelId, "outline");
      if (!draft) {
        throw new Error(`小说缺少 outline 前置资产草案：${novelId}`);
      }
      return {
        exitCode: 0,
        data: draft.asset,
        lines: [
          `初始大纲草案: ${draft.status}`,
          JSON.stringify(draft.asset, null, 2),
        ],
      };
    }),
    define(["outline", "history"], "查看大纲修改版本历史", "outline history [--novel-id <id>] [--json]", ["outline history"], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      requireNovel(context, novelId);
      const versions = context.services.workspace.listOutlineVersions<OutlineRevisionVersion>(
        novelId,
      );
      return {
        exitCode: 0,
        data: versions,
        lines: versions.length === 0
          ? ["暂无大纲修改版本。"]
          : [
              "大纲版本历史:",
              ...versions.map((stored) => {
                const version = stored.version;
                return [
                  stored.versionId,
                  stored.status,
                  stored.scope,
                  stored.targetVolumeId || "-",
                  version.instruction || "-",
                  stored.createdAt,
                ].join("  ");
              }),
            ],
      };
    }),
    define(["task", "list"], "查看当前小说任务历史", "task list [--status <状态>] [--novel-id <id>] [--json]", ["task list", "task list --status failed"], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      requireNovel(context, novelId);
      const status = readStringOption(command, "status");
      if (status && !isTaskStatus(status)) {
        throw new CliUsageError(`未知任务状态：${status}`);
      }
      const tasks = context.services.workspace.listTasks(
        novelId,
        status as TaskStatus | undefined,
      );
      return {
        exitCode: 0,
        data: tasks,
        lines: tasks.length === 0
          ? ["暂无匹配任务。"]
          : [
              "任务列表:",
              ...tasks.map((task) => [
                task.taskId,
                task.status,
                task.workflowName,
                task.title,
                task.error || task.outputSnapshot,
              ].join("  ")),
            ],
      };
    }),
    define(["task", "show"], "查看任务详情", "task show <taskId> [--json]", ["task show task-123"], async (context, command) => {
      const taskId = command.positionals[0];
      if (!taskId) {
        throw new CliUsageError("必须提供 taskId。");
      }
      const task = context.services.workspace.getTask(taskId);
      if (!task) {
        throw new Error(`未找到任务：${taskId}`);
      }
      if (
        context.session.activeNovelId
        && task.novelId !== context.session.activeNovelId
      ) {
        throw new Error(`任务 ${taskId} 不属于当前小说。`);
      }
      return {
        exitCode: 0,
        data: task,
        lines: [
          `任务: ${task.title}`,
          `ID: ${task.taskId}`,
          `小说: ${task.novelId}`,
          `Workflow: ${task.workflowName}`,
          `状态: ${task.status}`,
          `输入: ${task.inputSnapshot}`,
          `输出: ${task.outputSnapshot}`,
          ...(task.error ? [`错误: ${task.error}`] : []),
          `开始: ${task.startedAt}`,
          `结束: ${task.finishedAt || "未结束"}`,
        ],
      };
    }, { maxPositionals: 1 }),
  ];
}

function createWorkflowCommands(): CommandDefinition[] {
  return [
    define(["preflight", "run"], "生成小说基础盘、设定和初始大纲", "preflight run --seed-notes <想法> [--target-words <字数>] [--chapter-plans <10-20>] [--novel-id <id>] [--mock] [--json]", ['preflight run --seed-notes "主角必须在失忆前关闭裂界" --target-words 120000', 'preflight run --seed-notes "一个模糊想法" --mock'], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      requireNovel(context, novelId);
      let seedNotes = readStringOption(command, "seed-notes")?.trim();
      let targetWords = readIntegerOption(command, "target-words", { min: 1 });
      let chapterPlanCount = readIntegerOption(command, "chapter-plans", {
        min: 10,
        max: 20,
      });
      if (!seedNotes && context.interactive) {
        seedNotes = (await context.io.question("请输入小说初步想法：")).trim();
      }
      if (!seedNotes) {
        throw new CliUsageError("必须提供 --seed-notes。");
      }
      if (targetWords === undefined && context.interactive) {
        targetWords = parseOptionalPromptInteger(
          await context.io.question("目标总字数（可留空）："),
          "目标总字数",
          1,
        );
      }
      if (chapterPlanCount === undefined && context.interactive) {
        chapterPlanCount = parseOptionalPromptInteger(
          await context.io.question("首批章纲数量 10-20（默认 12）："),
          "首批章纲数量",
          10,
          20,
        ) ?? 12;
      }
      const model = createOptionalMockModel(
        context,
        command,
        "preflight",
        novelId,
        { chapterPlanCount, targetWords },
      );
      const result = await runNovelPreflightWorkflow({
        novelId,
        seedNotes,
        targetWords,
        chapterPlanCount,
        model,
        repository: context.services.preflight,
      });
      return {
        exitCode: 0,
        data: result,
        lines: [
          `前置资产已生成，状态：${result.task.status}`,
          `标题候选：${result.foundationDraft.titleCandidates.join(" / ") || "暂无"}`,
          `分卷：${result.outlineDraft.volumes.length}`,
          `首批章纲：${result.chapterPlans.length}`,
          `评审：基础盘 ${result.reviews.foundation.overallScore} / 设定 ${result.reviews.setting.overallScore} / 大纲 ${result.reviews.outline.overallScore}`,
        ],
      };
    }),
    define(["outline", "revise-master"], "按自然语言修改总纲", "outline revise-master --instruction <修改要求> [--source-version-id <id>] [--novel-id <id>] [--mock] [--json]", ['outline revise-master --instruction "把最终决战提前到第三卷末"'], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      requireNovel(context, novelId);
      const instruction = await resolveInstruction(context, command);
      const sourceVersionId = readStringOption(command, "source-version-id");
      const sourceOutline = resolveOutlineSource(
        context,
        novelId,
        sourceVersionId,
      );
      const model = createOptionalMockModel(
        context,
        command,
        "revise-master",
        novelId,
        { sourceOutline, instruction },
      );
      const result = await runReviseMasterOutlineWorkflow({
        novelId,
        instruction,
        sourceVersionId,
        model,
        repository: context.services.preflight,
      });
      return revisionResult(result);
    }),
    define(["outline", "confirm"], "确认前置资产和大纲并进入章节生产准备", "outline confirm [--version-id <id>] [--title <小说名>] [--novel-id <id>] [--json]", ["outline confirm", 'outline confirm --title "裂界回声"', "outline confirm --version-id outline-version-123"], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      const novel = requireNovel(context, novelId);
      let title = readStringOption(command, "title")?.trim();
      if (!title && context.interactive && !novel.title.trim()) {
        const foundation = context.services.workspace.getDraft<{
          titleCandidates?: string[];
        }>(novelId, "foundation");
        const candidates = foundation?.asset.titleCandidates?.filter(Boolean) ?? [];
        const prompt = candidates.length > 0
          ? `小说标题（留空使用「${candidates[0]}」）：`
          : "小说标题（可留空）：";
        title = (await context.io.question(prompt)).trim()
          || candidates[0];
      }
      const result = await runConfirmOutlineWorkflow({
        novelId,
        versionId: readStringOption(command, "version-id"),
        title,
        repository: context.services.preflight,
      });
      return {
        exitCode: 0,
        data: result,
        lines: [
          "前置资产和大纲已确认。",
          `来源：${result.versionId ?? "初始大纲草案"}`,
          `分卷：${result.outline.volumes.length}`,
          `已确认章纲：${result.chapterPlans.length}`,
          "小说已具备章节生产上下文。",
        ],
      };
    }),
    define(["outline", "revise-volume"], "按自然语言修改指定卷纲", "outline revise-volume <volumeId> --instruction <修改要求> [--source-version-id <id>] [--novel-id <id>] [--mock] [--json]", ['outline revise-volume volume-1 --instruction "改为营救失踪盟友"'], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      requireNovel(context, novelId);
      let volumeId = command.positionals[0]?.trim();
      if (!volumeId && context.interactive) {
        volumeId = (await context.io.question("请输入目标 volumeId：")).trim();
      }
      if (!volumeId) {
        throw new CliUsageError("必须提供目标 volumeId。");
      }
      const instruction = await resolveInstruction(context, command);
      const sourceVersionId = readStringOption(command, "source-version-id");
      const sourceOutline = resolveOutlineSource(
        context,
        novelId,
        sourceVersionId,
      );
      const model = createOptionalMockModel(
        context,
        command,
        "revise-volume",
        novelId,
        { sourceOutline, instruction, volumeId },
      );
      const result = await runReviseVolumeOutlineWorkflow({
        novelId,
        volumeId,
        instruction,
        sourceVersionId,
        model,
        repository: context.services.preflight,
      });
      return revisionResult(result);
    }, { maxPositionals: 1 }),
    define(["chapter", "write"], "生成并评审一个章节草稿", "chapter write [--chapter-no <编号>] [--intent <作者想法>] [--target-words <字数>] [--quality-threshold <0-100>] [--max-revision-rounds <0-5>] [--novel-id <id>] [--mock] [--json]", ['chapter write --chapter-no 1 --intent "主角主动试探裂界"', "chapter write --mock"], async (context, command) => {
      const novelId = resolveNovelId(context, command);
      requireNovel(context, novelId);
      const chapterNo = readIntegerOption(command, "chapter-no", { min: 1 });
      const targetWords = readIntegerOption(command, "target-words", { min: 1 });
      const qualityThreshold = readIntegerOption(command, "quality-threshold", {
        min: 0,
        max: 100,
      });
      const maxRevisionRounds = readIntegerOption(
        command,
        "max-revision-rounds",
        { min: 0, max: 5 },
      );
      const authorIntent = readStringOption(command, "intent");
      const existingAssets = readBooleanOption(command, "mock")
        ? context.services.chapter.assembleChapterProductionContext({
            novelId,
            chapterNo,
            authorIntent,
          })
        : undefined;
      const model = createOptionalMockModel(
        context,
        command,
        "chapter-write",
        novelId,
        { hasExistingChapterPlan: Boolean(existingAssets?.chapterPlan) },
      );
      const result = await runWriteNextChapterWorkflow({
        novelId,
        chapterNo,
        authorIntent,
        targetWords,
        qualityThreshold,
        maxRevisionRounds,
        model,
        repository: context.services.chapter,
      });
      return {
        exitCode: 0,
        data: result,
        lines: [
          `第 ${result.chapterPlan.chapterNo} 章《${result.finalDraft.title}》`,
          `字数：${result.finalDraft.wordCount}`,
          `质量门禁：${result.qualityGate.passed ? "通过" : "未通过"} / ${result.qualityGate.score}`,
          `自动修订：${result.qualityGate.revisionRounds} 轮`,
          "",
          result.finalDraft.content,
        ],
      };
    }),
  ];
}

function define(
  path: string[],
  summary: string,
  usage: string,
  examples: string[],
  execute: CommandDefinition["execute"],
  options: { maxPositionals?: number } = {},
): CommandDefinition {
  return {
    path,
    summary,
    usage,
    examples,
    allowedOptions: Array.from(
      usage.matchAll(/--([a-z0-9-]+)/gi),
      (match) => match[1]!,
    ),
    maxPositionals: options.maxPositionals ?? 0,
    execute,
  };
}

function formatNovel(novel: ReturnType<CliCommandContext["services"]["workspace"]["getNovel"]> & {}) {
  if (!novel) return [];
  return [
    `小说: ${displayNovelTitle(novel)}`,
    `ID: ${novel.novelId}`,
    `题材: ${novel.genre || "未设置"}`,
    `阶段: ${novel.stage}`,
    `钩子: ${novel.hook || "未设置"}`,
    `目标字数: ${novel.targetWords || "未设置"}`,
    `章节进度: ${novel.completedChapters}/${novel.totalChapters}`,
    `当前卷: ${novel.currentVolume || "未设置"}`,
    `最近任务: ${novel.recentTask}`,
  ];
}

function isTaskStatus(value: string): value is TaskStatus {
  return [
    "queued",
    "running",
    "waiting_for_user",
    "succeeded",
    "failed",
    "cancelled",
  ].includes(value);
}

async function resolveInstruction(
  context: CliCommandContext,
  command: ParsedCommand,
) {
  let instruction = readStringOption(command, "instruction")?.trim();
  if (!instruction && context.interactive) {
    instruction = (await context.io.question("请输入修改要求：")).trim();
  }
  if (!instruction) {
    throw new CliUsageError("必须提供 --instruction。");
  }
  return instruction;
}

function resolveOutlineSource(
  context: CliCommandContext,
  novelId: string,
  sourceVersionId?: string,
): InitialOutlineDraft {
  if (sourceVersionId) {
    const stored = context.services.workspace.getOutlineVersion<OutlineRevisionVersion>(
      novelId,
      sourceVersionId,
    );
    if (!stored) {
      throw new Error(`未找到大纲版本：${sourceVersionId}`);
    }
    return stored.version.revisedOutline;
  }
  const latest = context.services.workspace.getLatestOutlineVersion<OutlineRevisionVersion>(
    novelId,
  );
  if (latest) {
    return latest.version.revisedOutline;
  }
  const draft = context.services.workspace.getDraft<InitialOutlineDraft>(
    novelId,
    "outline",
  );
  if (!draft) {
    throw new Error(`小说缺少 outline 前置资产草案：${novelId}`);
  }
  return draft.asset;
}

function createOptionalMockModel(
  context: CliCommandContext,
  command: ParsedCommand,
  capability: Parameters<NonNullable<CliCommandContext["createMockModel"]>>[0],
  novelId: string,
  options?: Parameters<NonNullable<CliCommandContext["createMockModel"]>>[2],
): ChatModel | undefined {
  if (!readBooleanOption(command, "mock")) {
    return undefined;
  }
  if (!context.createMockModel) {
    throw new Error("CLI 未配置 mock 模型工厂。");
  }
  return context.createMockModel(capability, novelId, options);
}

function parseOptionalPromptInteger(
  value: string,
  label: string,
  min: number,
  max?: number,
) {
  const normalized = value.trim();
  if (!normalized) return undefined;
  const parsed = Number(normalized);
  if (
    !Number.isInteger(parsed)
    || parsed < min
    || (max !== undefined && parsed > max)
  ) {
    throw new CliUsageError(
      `${label}必须是 ${min}${max === undefined ? " 以上" : `-${max}`} 的整数。`,
    );
  }
  return parsed;
}

function revisionResult(
  result: Awaited<
    ReturnType<
      typeof runReviseMasterOutlineWorkflow | typeof runReviseVolumeOutlineWorkflow
    >
  >,
) {
  return {
    exitCode: 0 as const,
    data: result,
    lines: [
      `大纲修改版本：${result.version.versionId}`,
      `状态：${result.version.status}`,
      `评审分数：${result.version.review.overallScore}`,
      `修改摘要：${result.version.diffSummary.join("；") || "暂无"}`,
      `结构冲突：${result.version.impactAnalysis.conflicts.length}`,
      `编号变化：${result.version.chapterNumberChanges.length}`,
    ],
  };
}
