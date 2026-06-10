import type { AgentCapability, AgentCapabilityResult, ChatCompletionInput } from "../../core/types.js";
import { BaseAgent, type BaseAgentRuntime } from "../../core/baseAgent.js";
import type { CharacterSeed, RelationshipSeed } from "../preflight/types.js";
import {
  buildRunMeta,
  optionalText,
  parseJsonPayload,
  requiredText,
  stringArray,
  type CompletionWithTiming,
} from "../preflight/runtime.js";
import { buildGenerateSettingMessages } from "./prompts/generateSettingPrompt.js";
import type { GenerateSettingDraftInput, GenerateSettingDraftOutput, SettingJsonPayload } from "./types.js";

const CAPABILITY_ID = "setting.generateSettingDraft";

export class SettingAgent extends BaseAgent {
  readonly id = "setting";
  readonly name = "设定 Agent";

  constructor(runtime: BaseAgentRuntime = {}) {
    super(runtime);
  }

  async generateSettingDraft(
    input: GenerateSettingDraftInput,
  ): Promise<AgentCapabilityResult<GenerateSettingDraftOutput>> {
    assertInput(input);
    const run = await this.completeWithTiming({
      messages: buildGenerateSettingMessages(input),
      temperature: 0.5,
      topP: 0.86,
      maxTokens: 3600,
      responseFormat: "json_object",
    });
    const parsed = parseJsonPayload<SettingJsonPayload>("SettingAgent", run.completion.content);

    return {
      output: {
        novelId: input.novelId,
        background: requiredText(parsed.background, "background"),
        worldRules: stringArray(parsed.worldRules),
        powerSystem: optionalText(parsed.powerSystem) || undefined,
        factions: stringArray(parsed.factions),
        locations: stringArray(parsed.locations),
        constraints: stringArray(parsed.constraints),
        characterSeeds: normalizeCharacters(parsed.characterSeeds),
        relationshipSeeds: normalizeRelationships(parsed.relationshipSeeds),
        styleGuidance: stringArray(parsed.styleGuidance),
        forbiddenExpressions: stringArray(parsed.forbiddenExpressions),
        canonCandidates: stringArray(parsed.canonCandidates),
        risks: stringArray(parsed.risks),
        status: "待确认",
      },
      run: buildRunMeta(this.id, CAPABILITY_ID, run),
    };
  }

  private async completeWithTiming(input: ChatCompletionInput): Promise<CompletionWithTiming> {
    const model = await this.getModel();
    const startedAt = this.getNow().toISOString();
    const completion = await model.complete(input);
    const finishedAt = this.getNow().toISOString();
    return { completion, startedAt, finishedAt };
  }
}

export const generateSettingDraftCapability: AgentCapability<
  GenerateSettingDraftInput,
  GenerateSettingDraftOutput
> = {
  id: CAPABILITY_ID,
  description: "根据小说基础盘生成世界观、人物、关系和风格设定草案。",
  async run(input, runtime) {
    return new SettingAgent(runtime).generateSettingDraft(input);
  },
};

function assertInput(input: GenerateSettingDraftInput) {
  if (!input.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }
  if (input.foundation.novelId !== input.novelId) {
    throw new Error("foundation.novelId 与 novelId 不一致");
  }
}

function normalizeCharacters(value: unknown): CharacterSeed[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const candidate = item as Partial<CharacterSeed>;
    const name = optionalText(candidate.name);
    const role = optionalText(candidate.role);
    if (!name || !role) {
      return [];
    }
    return [{
      id: optionalText(candidate.id) || `character-${index + 1}`,
      name,
      role,
      desire: optionalText(candidate.desire),
      conflict: optionalText(candidate.conflict),
      initialState: optionalText(candidate.initialState),
      arcHint: optionalText(candidate.arcHint),
    }];
  });
}

function normalizeRelationships(value: unknown): RelationshipSeed[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") {
      return [];
    }
    const candidate = item as Partial<RelationshipSeed>;
    const fromCharacterId = optionalText(candidate.fromCharacterId);
    const toCharacterId = optionalText(candidate.toCharacterId);
    if (!fromCharacterId || !toCharacterId) {
      return [];
    }
    return [{
      id: optionalText(candidate.id) || `relationship-${index + 1}`,
      fromCharacterId,
      toCharacterId,
      relation: optionalText(candidate.relation),
      tension: optionalText(candidate.tension),
    }];
  });
}
