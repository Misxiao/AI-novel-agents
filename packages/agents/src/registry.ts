import type { Capability } from "./core/capability.js";
import * as inspiration from "./agents/inspiration.js";
import * as setting from "./agents/setting.js";
import * as outline from "./agents/outline.js";
import * as plan from "./agents/plan.js";
import * as writer from "./agents/writer.js";
import * as reviewer from "./agents/reviewer.js";
import * as memory from "./agents/memory.js";

/** 全部 agent 能力：将来的 director agent 通过这张表发现和调用能力 */
export const capabilities = [
  inspiration.generateFoundation,
  inspiration.reviseFoundation,
  setting.generateSetting,
  setting.reviseSetting,
  outline.generateMainOutline,
  outline.generateVolumeOutline,
  outline.reviseOutline,
  plan.planChapter,
  plan.reviseChapterPlan,
  writer.writeChapter,
  writer.reviseChapter,
  writer.polishChapter,
  reviewer.reviewChapter,
  reviewer.checkConsistency,
  reviewer.reviewOutline,
  memory.extractChapterMemory,
  memory.summarizeVolume,
  memory.updateGlobalRecap,
] as const;

export function getCapability(id: string): Capability<unknown, unknown> | undefined {
  return capabilities.find((capability) => capability.id === id) as
    | Capability<unknown, unknown>
    | undefined;
}

export function listCapabilities(): Array<{
  id: string;
  agentId: string;
  summary: string;
  inputHint: string;
}> {
  return capabilities.map(({ id, agentId, summary, inputHint }) => ({
    id,
    agentId,
    summary,
    inputHint,
  }));
}
