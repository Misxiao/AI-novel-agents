import type {
  AgentCapability,
  AgentCapabilityResult,
  ChatCompletionInput,
} from "../../core/types.js";
import { BaseAgent, type BaseAgentRuntime } from "../../core/baseAgent.js";
import {
  buildRunMeta,
  optionalText,
  parseJsonPayload,
  positiveInteger,
  requiredText,
  stringArray,
  type CompletionWithTiming,
} from "../preflight/runtime.js";
import { buildGenerateFoundationMessages } from "./prompts/generateFoundationPrompt.js";
import type {
  FoundationJsonPayload,
  GenerateFoundationDraftInput,
  GenerateFoundationDraftOutput,
} from "./types.js";

const CAPABILITY_ID = "inspiration.generateFoundationDraft";

export class InspirationAgent extends BaseAgent {
  readonly id = "inspiration";
  readonly name = "灵感 Agent";

  constructor(runtime: BaseAgentRuntime = {}) {
    super(runtime);
  }

  async generateFoundationDraft(
    input: GenerateFoundationDraftInput,
  ): Promise<AgentCapabilityResult<GenerateFoundationDraftOutput>> {
    assertInput(input);
    const run = await this.completeWithTiming({
      messages: buildGenerateFoundationMessages(input),
      temperature: 0.62,
      topP: 0.9,
      maxTokens: 2600,
      responseFormat: "json_object",
    });
    const parsed = parseJsonPayload<FoundationJsonPayload>("InspirationAgent", run.completion.content);
    const chapterWordTarget = positiveInteger(parsed.chapterWordTarget, 3000);
    const targetWords = positiveInteger(parsed.targetWords, input.targetWords ?? 0);

    return {
      output: {
        novelId: input.novelId,
        titleCandidates: stringArray(parsed.titleCandidates),
        synopsis: requiredText(parsed.synopsis, "synopsis"),
        hook: requiredText(parsed.hook, "hook"),
        sellingPoint: requiredText(parsed.sellingPoint, "sellingPoint"),
        premise: requiredText(parsed.premise, "premise"),
        mainConflict: requiredText(parsed.mainConflict, "mainConflict"),
        storyEngine: requiredText(parsed.storyEngine, "storyEngine"),
        targetReaders: optionalText(parsed.targetReaders) || "待进一步确认的中文网文读者",
        tone: optionalText(parsed.tone) || "动作与冲突驱动",
        targetWords,
        estimatedChapters: positiveInteger(
          parsed.estimatedChapters,
          targetWords > 0 ? Math.ceil(targetWords / chapterWordTarget) : 0,
        ),
        estimatedVolumes: positiveInteger(parsed.estimatedVolumes, targetWords > 0 ? Math.max(1, Math.ceil(targetWords / 100000)) : 1),
        chapterWordTarget,
        risks: stringArray(parsed.risks),
        questionsForAuthor: stringArray(parsed.questionsForAuthor),
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

export const generateFoundationDraftCapability: AgentCapability<
  GenerateFoundationDraftInput,
  GenerateFoundationDraftOutput
> = {
  id: CAPABILITY_ID,
  description: "把用户零散想法整理为小说基础盘草案。",
  async run(input, runtime) {
    return new InspirationAgent(runtime).generateFoundationDraft(input);
  },
};

function assertInput(input: GenerateFoundationDraftInput) {
  if (!input.novelId.trim()) {
    throw new Error("novelId 不能为空");
  }
  if (!input.seedNotes.trim()) {
    throw new Error("seedNotes 不能为空");
  }
}
