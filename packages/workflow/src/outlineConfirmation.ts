import type {
  InitialOutlineDraft,
  NovelFoundationDraft,
  NovelSettingDraft,
} from "../../agents/src/index.js";
import {
  NovelPreflightRepository,
  type NovelPreflightRepositoryLike,
} from "../../repositories/src/index.js";
import type { OutlineRevisionVersion } from "./outlineRevision.js";

export interface ConfirmedNovelOutline extends InitialOutlineDraft {
  logline: string;
  baseline: {
    hook: string;
    sellingPoint: string;
    mainConflict: string;
    storyEngine: string;
    synopsisExcerpt: string;
  };
  setting: {
    background: string;
    worldRules: string[];
    powerSystem?: string;
    factions: string[];
    locations: string[];
    constraints: string[];
    characterSeeds: NovelSettingDraft["characterSeeds"];
    relationshipSeeds: NovelSettingDraft["relationshipSeeds"];
  };
  styleGuidance: string[];
  forbiddenExpressions: string[];
  canonCandidates: string[];
  status: "已确认";
}

export interface ConfirmOutlineWorkflowInput {
  novelId: string;
  versionId?: string;
  title?: string;
  repository?: NovelPreflightRepositoryLike;
}

export interface ConfirmOutlineWorkflowResult {
  task: {
    taskId: string;
    novelId: string;
    title: string;
    workflowName: "confirm-outline";
    status: "succeeded";
    inputSnapshot: string;
    outputSnapshot: string;
    startedAt: string;
    finishedAt: string;
  };
  source: "preflight" | "revision";
  versionId?: string;
  outline: ConfirmedNovelOutline;
  chapterPlans: ConfirmedNovelOutline["chapterPlans"];
}

export async function runConfirmOutlineWorkflow(
  input: ConfirmOutlineWorkflowInput,
): Promise<ConfirmOutlineWorkflowResult> {
  if (!input.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }

  const repository = input.repository ?? new NovelPreflightRepository();
  const novel = repository.getNovel(input.novelId);
  if (!novel) {
    throw new Error(`未找到小说项目：${input.novelId}`);
  }

  const foundation = requireDraft<NovelFoundationDraft>(
    repository,
    input.novelId,
    "foundation",
  );
  const setting = requireDraft<NovelSettingDraft>(
    repository,
    input.novelId,
    "setting",
  );
  const source = resolveOutlineSource(repository, input.novelId, input.versionId);
  const selectedTitle = input.title?.trim()
    || novel.title.trim()
    || foundation.titleCandidates.find((title) => title.trim())?.trim()
    || "未命名小说";
  const confirmedFoundation: NovelFoundationDraft = {
    ...foundation,
    status: "已确认",
  };
  const confirmedSetting: NovelSettingDraft = {
    ...setting,
    status: "已确认",
  };
  const chapterPlans = source.outline.chapterPlans.map((plan) => ({
    ...plan,
    novelId: input.novelId,
    status: "已确认",
  }));
  const confirmedOutline: ConfirmedNovelOutline = {
    ...source.outline,
    novelId: input.novelId,
    logline: foundation.premise || foundation.synopsis,
    baseline: {
      hook: foundation.hook,
      sellingPoint: foundation.sellingPoint,
      mainConflict: foundation.mainConflict,
      storyEngine: foundation.storyEngine,
      synopsisExcerpt: foundation.synopsis,
    },
    setting: {
      background: setting.background,
      worldRules: setting.worldRules,
      ...(setting.powerSystem ? { powerSystem: setting.powerSystem } : {}),
      factions: setting.factions,
      locations: setting.locations,
      constraints: setting.constraints,
      characterSeeds: setting.characterSeeds,
      relationshipSeeds: setting.relationshipSeeds,
    },
    styleGuidance: setting.styleGuidance,
    forbiddenExpressions: setting.forbiddenExpressions,
    canonCandidates: setting.canonCandidates,
    chapterPlans,
    status: "已确认",
  };

  const startedAt = new Date().toISOString();
  const finishedAt = new Date().toISOString();
  const taskId = `task-confirm-outline-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const outputSnapshot = [
    `已确认小说《${selectedTitle}》的前置资产和正式大纲`,
    `分卷 ${confirmedOutline.volumes.length} 个`,
    source.versionId ? `来源版本 ${source.versionId}` : "来源初始大纲草案",
  ].join("；");
  const task = {
    taskId,
    novelId: input.novelId,
    title: "确认小说前置资产与大纲",
    workflowName: "confirm-outline" as const,
    status: "succeeded" as const,
    inputSnapshot: source.versionId
      ? `确认大纲版本：${source.versionId}`
      : "确认初始前置资产和大纲草案",
    outputSnapshot,
    startedAt,
    finishedAt,
  };

  repository.confirmOutline({
    novelId: input.novelId,
    foundation: confirmedFoundation,
    setting: confirmedSetting,
    outline: confirmedOutline,
    chapterPlans,
    ...(source.versionId ? { selectedVersionId: source.versionId } : {}),
    novel: {
      title: selectedTitle,
      hook: foundation.hook,
      targetReaders: foundation.targetReaders,
      targetWords: foundation.targetWords,
      totalChapters: 0,
      currentVolume: confirmedOutline.volumes[0]?.title ?? "",
    },
    task,
  });

  return {
    task,
    source: source.versionId ? "revision" : "preflight",
    ...(source.versionId ? { versionId: source.versionId } : {}),
    outline: confirmedOutline,
    chapterPlans,
  };
}

function resolveOutlineSource(
  repository: NovelPreflightRepositoryLike,
  novelId: string,
  versionId?: string,
) {
  if (versionId) {
    const stored = repository.getOutlineVersion<OutlineRevisionVersion>(
      novelId,
      versionId,
    );
    if (!stored) {
      throw new Error(`未找到大纲版本：${versionId}`);
    }
    if (stored.status === "需修订") {
      throw new Error(`大纲版本仍需修订，不能确认：${versionId}`);
    }
    return {
      outline: stored.version.revisedOutline,
      versionId: stored.versionId,
    };
  }

  const latest = repository.getLatestOutlineVersion<OutlineRevisionVersion>(novelId);
  if (latest?.status === "待确认") {
    return {
      outline: latest.version.revisedOutline,
      versionId: latest.versionId,
    };
  }
  if (latest?.status === "需修订") {
    throw new Error(
      `最新大纲版本仍需修订，请修订或显式选择其它可确认版本：${latest.versionId}`,
    );
  }

  return {
    outline: requireDraft<InitialOutlineDraft>(repository, novelId, "outline"),
    versionId: undefined,
  };
}

function requireDraft<TAsset>(
  repository: NovelPreflightRepositoryLike,
  novelId: string,
  kind: "foundation" | "setting" | "outline",
) {
  const draft = repository.getDraft<TAsset>(novelId, kind);
  if (!draft) {
    throw new Error(`小说缺少${kind}前置资产草案：${novelId}`);
  }
  if (draft.status === "需修订") {
    throw new Error(`${kind} 前置资产仍需修订，不能确认：${novelId}`);
  }
  return draft.asset;
}
