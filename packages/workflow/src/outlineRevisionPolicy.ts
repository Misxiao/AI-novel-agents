import type {
  ChapterPlanInput,
  InitialOutlineDraft,
  OutlineRevisionCandidate,
  OutlineRevisionConflict,
  OutlineRevisionScope,
  VolumePlanDraft,
} from "../../agents/src/index.js";

export interface ApplyOutlineRevisionPolicyInput {
  scope: OutlineRevisionScope;
  targetVolumeId?: string;
  sourceOutline: InitialOutlineDraft;
  candidate: OutlineRevisionCandidate;
  protectedChapterNos: number[];
}

export interface ApplyOutlineRevisionPolicyResult {
  candidate: OutlineRevisionCandidate;
  hasCriticalConflict: boolean;
}

export function applyOutlineRevisionPolicy(
  input: ApplyOutlineRevisionPolicyInput,
): ApplyOutlineRevisionPolicyResult {
  const conflicts = [...input.candidate.impactAnalysis.conflicts];
  const source = hydrateVolumeIds(input.sourceOutline);
  let revised = hydrateVolumeIds(input.candidate.revisedOutline);

  validateNovelBoundary(source, revised, conflicts);
  if (input.scope === "volume") {
    validateVolumeBoundary(input, source, revised, conflicts);
  }

  const protectedPlans = source.chapterPlans.filter((plan) =>
    input.protectedChapterNos.includes(plan.chapterNo)
  );
  revised = restoreProtectedStructure(source, revised, protectedPlans, conflicts);
  const orderedPlans = orderPlansByVolume(revised, conflicts);
  const renumbered = renumberPlans(orderedPlans, source, protectedPlans, conflicts);
  revised = {
    ...revised,
    chapterPlans: renumbered.plans,
    volumes: updateChapterRanges(revised.volumes, renumbered.plans),
    status: "待确认",
  };

  const candidate: OutlineRevisionCandidate = {
    ...input.candidate,
    revisedOutline: revised,
    impactAnalysis: {
      ...input.candidate.impactAnalysis,
      conflicts: dedupeConflicts(conflicts),
    },
    chapterNumberChanges: renumbered.changes,
  };

  return {
    candidate,
    hasCriticalConflict: candidate.impactAnalysis.conflicts.some(
      (conflict) => conflict.severity === "critical",
    ),
  };
}

function hydrateVolumeIds(outline: InitialOutlineDraft): InitialOutlineDraft {
  return {
    ...outline,
    chapterPlans: outline.chapterPlans.map((plan) => {
      const volume = outline.volumes.find((item) =>
        item.id === plan.volumeId || item.title === plan.volumeTitle
      );
      return {
        ...plan,
        volumeId: plan.volumeId || volume?.id || "",
        volumeTitle: volume?.title || plan.volumeTitle,
      };
    }),
  };
}

function validateNovelBoundary(
  source: InitialOutlineDraft,
  revised: InitialOutlineDraft,
  conflicts: OutlineRevisionConflict[],
) {
  if (source.novelId !== revised.novelId) {
    conflicts.push(critical(
      "novel-boundary",
      "novel_boundary",
      "修改候选的 novelId 与源大纲不一致。",
      "使用同一小说项目重新生成修改候选。",
    ));
  }
  const duplicateVolumeId = findDuplicate(revised.volumes.map((volume) => volume.id));
  if (duplicateVolumeId) {
    conflicts.push(critical(
      `duplicate-volume-${duplicateVolumeId}`,
      "duplicate_id",
      `修改候选中存在重复 volumeId：${duplicateVolumeId}。`,
      "为新增或拆分后的卷生成新的稳定 ID。",
    ));
  }
  const duplicateChapterId = findDuplicate(revised.chapterPlans.map((plan) => plan.id));
  if (duplicateChapterId) {
    conflicts.push(critical(
      `duplicate-chapter-${duplicateChapterId}`,
      "duplicate_id",
      `修改候选中存在重复章纲 ID：${duplicateChapterId}。`,
      "为新增章纲生成新的稳定 ID。",
    ));
  }
}

function validateVolumeBoundary(
  input: ApplyOutlineRevisionPolicyInput,
  source: InitialOutlineDraft,
  revised: InitialOutlineDraft,
  conflicts: OutlineRevisionConflict[],
) {
  const targetVolumeId = input.targetVolumeId ?? "";
  if (!targetVolumeId || !source.volumes.some((volume) => volume.id === targetVolumeId)) {
    conflicts.push(critical(
      "volume-target-missing",
      "volume_scope",
      "卷纲修改缺少有效目标卷。",
      "指定源大纲中存在的 volumeId 后重新修改。",
    ));
    return;
  }
  if (!deepEqual(source.masterOutline, revised.masterOutline)) {
    conflicts.push(critical(
      "volume-master-overreach",
      "master_outline_overreach",
      "卷纲修改候选越权修改了总纲。",
      "保留总纲不变；如需修改总纲，请另开总纲修改任务。",
    ));
  }
  for (const sourceVolume of source.volumes) {
    if (sourceVolume.id === targetVolumeId) continue;
    const candidateVolume = revised.volumes.find((volume) => volume.id === sourceVolume.id);
    if (!candidateVolume || !deepEqual(sourceVolume, candidateVolume)) {
      conflicts.push(critical(
        `volume-cross-scope-${sourceVolume.id}`,
        "cross_volume_change",
        `卷纲修改候选越权影响了其他卷：${sourceVolume.title}。`,
        "仅保留目标卷变化，其他卷应与源版本完全一致。",
      ));
    }
  }
}

function restoreProtectedStructure(
  source: InitialOutlineDraft,
  revised: InitialOutlineDraft,
  protectedPlans: ChapterPlanInput[],
  conflicts: OutlineRevisionConflict[],
): InitialOutlineDraft {
  let volumes = [...revised.volumes];
  const plans = [...revised.chapterPlans];

  for (const protectedPlan of protectedPlans) {
    const sourceVolumeId = resolveVolumeId(protectedPlan, source.volumes);
    const sourceVolume = source.volumes.find((volume) => volume.id === sourceVolumeId);
    if (sourceVolume && !volumes.some((volume) => volume.id === sourceVolumeId)) {
      conflicts.push(critical(
        `protected-volume-${sourceVolumeId}`,
        "protected_chapter",
        `含已确认章节的卷「${sourceVolume.title}」不能删除。`,
        "恢复该卷，或先通过独立迁移流程处理已确认章节。",
      ));
      volumes = restoreVolumeAtSourcePosition(volumes, source.volumes, sourceVolume);
    }

    const candidateIndex = plans.findIndex((plan) => plan.id === protectedPlan.id);
    if (candidateIndex < 0) {
      conflicts.push(critical(
        `protected-plan-delete-${protectedPlan.id}`,
        "protected_chapter",
        `已确认章节对应章纲 ${protectedPlan.id} 不能删除。`,
        "恢复该章纲及其原卷归属和章节编号。",
      ));
      plans.push({ ...protectedPlan });
      continue;
    }

    const candidatePlan = plans[candidateIndex]!;
    const candidateVolumeId = resolveVolumeId(candidatePlan, volumes);
    if (
      candidatePlan.chapterNo !== protectedPlan.chapterNo
      || candidateVolumeId !== sourceVolumeId
      || !sameProtectedPlanContent(candidatePlan, protectedPlan)
    ) {
      conflicts.push(critical(
        `protected-plan-change-${protectedPlan.id}`,
        "protected_chapter",
        `已确认章节对应章纲 ${protectedPlan.id} 被修改、迁移或重新编号。`,
        "恢复已确认章纲，修改范围只作用于未确认章纲。",
      ));
      plans[candidateIndex] = { ...protectedPlan };
    }
  }

  return { ...revised, volumes, chapterPlans: plans };
}

function orderPlansByVolume(
  outline: InitialOutlineDraft,
  conflicts: OutlineRevisionConflict[],
) {
  const volumeIds = new Set(outline.volumes.map((volume) => volume.id));
  const unknownPlans = outline.chapterPlans.filter((plan) =>
    !volumeIds.has(resolveVolumeId(plan, outline.volumes))
  );
  for (const plan of unknownPlans) {
    conflicts.push(critical(
      `chapter-volume-missing-${plan.id}`,
      "chapter_volume",
      `章纲 ${plan.id} 未绑定到有效 volumeId。`,
      "将章纲绑定到候选大纲中存在的卷。",
    ));
  }
  return [
    ...outline.volumes.flatMap((volume) =>
      outline.chapterPlans
        .filter((plan) => resolveVolumeId(plan, outline.volumes) === volume.id)
        .map((plan) => ({ ...plan, volumeId: volume.id, volumeTitle: volume.title }))
    ),
    ...unknownPlans,
  ];
}

function renumberPlans(
  plans: ChapterPlanInput[],
  source: InitialOutlineDraft,
  protectedPlans: ChapterPlanInput[],
  conflicts: OutlineRevisionConflict[],
) {
  const sourceById = new Map(source.chapterPlans.map((plan) => [plan.id, plan]));
  const fixedById = new Map(protectedPlans.map((plan) => [plan.id, plan.chapterNo]));
  const fixedNumbers = new Set(fixedById.values());
  const maxFixed = Math.max(0, ...fixedNumbers);
  let nextNumber = 1;
  let overflowNumber = maxFixed + 1;
  const renumbered: ChapterPlanInput[] = [];

  for (let index = 0; index < plans.length; index += 1) {
    const plan = plans[index]!;
    const fixedNumber = fixedById.get(plan.id);
    if (fixedNumber !== undefined) {
      if (fixedNumber !== nextNumber) {
        conflicts.push(anchorConflict(plan.id));
      }
      renumbered.push({ ...plan, chapterNo: fixedNumber });
      nextNumber = Math.max(nextNumber, fixedNumber + 1);
      continue;
    }

    while (fixedNumbers.has(nextNumber)) {
      nextNumber += 1;
    }
    const nextAnchor = findNextAnchor(plans, index + 1, fixedById);
    if (nextAnchor !== undefined && nextNumber >= nextAnchor) {
      conflicts.push(anchorConflict(plan.id));
      while (fixedNumbers.has(overflowNumber)) {
        overflowNumber += 1;
      }
      renumbered.push({ ...plan, chapterNo: overflowNumber });
      overflowNumber += 1;
      continue;
    }
    renumbered.push({ ...plan, chapterNo: nextNumber });
    nextNumber += 1;
  }

  const changes = renumbered.flatMap((plan) => {
    const previous = sourceById.get(plan.id);
    return previous && previous.chapterNo !== plan.chapterNo
      ? [{ chapterPlanId: plan.id, from: previous.chapterNo, to: plan.chapterNo }]
      : [];
  });
  return { plans: renumbered, changes };
}

function updateChapterRanges(
  volumes: VolumePlanDraft[],
  plans: ChapterPlanInput[],
) {
  return volumes.map((volume) => {
    const chapterNos = plans
      .filter((plan) => plan.volumeId === volume.id)
      .map((plan) => plan.chapterNo)
      .sort((left, right) => left - right);
    return {
      ...volume,
      chapterRange: chapterNos.length === 0
        ? ""
        : `${chapterNos[0]}-${chapterNos.at(-1)}`,
    };
  });
}

function findNextAnchor(
  plans: ChapterPlanInput[],
  startIndex: number,
  fixedById: Map<string, number>,
) {
  for (let index = startIndex; index < plans.length; index += 1) {
    const fixed = fixedById.get(plans[index]!.id);
    if (fixed !== undefined) return fixed;
  }
  return undefined;
}

function anchorConflict(chapterPlanId: string) {
  return critical(
    `chapter-anchor-${chapterPlanId}`,
    "chapter_number_anchor_conflict",
    `章纲 ${chapterPlanId} 无法在固定的已确认章节编号之间保持正确顺序。`,
    "减少锚点前的新增章纲，或调整到已确认章节之后。",
  );
}

function resolveVolumeId(plan: ChapterPlanInput, volumes: VolumePlanDraft[]) {
  return plan.volumeId || volumes.find((volume) => volume.title === plan.volumeTitle)?.id || "";
}

function restoreVolumeAtSourcePosition(
  current: VolumePlanDraft[],
  source: VolumePlanDraft[],
  restored: VolumePlanDraft,
) {
  const sourceIndex = source.findIndex((volume) => volume.id === restored.id);
  const precedingIds = new Set(source.slice(0, sourceIndex).map((volume) => volume.id));
  const insertAfter = current.reduce(
    (latest, volume, index) => precedingIds.has(volume.id) ? index : latest,
    -1,
  );
  const next = [...current];
  next.splice(insertAfter + 1, 0, restored);
  return next;
}

function sameProtectedPlanContent(left: ChapterPlanInput, right: ChapterPlanInput) {
  return left.title === right.title
    && left.objective === right.objective
    && left.hook === right.hook
    && left.status === right.status;
}

function critical(
  id: string,
  category: string,
  description: string,
  suggestion: string,
): OutlineRevisionConflict {
  return { id, severity: "critical", category, description, suggestion };
}

function dedupeConflicts(conflicts: OutlineRevisionConflict[]) {
  return Array.from(new Map(conflicts.map((conflict) => [conflict.id, conflict])).values());
}

function findDuplicate(values: string[]) {
  const seen = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) return value;
    seen.add(value);
  }
  return "";
}

function deepEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}
