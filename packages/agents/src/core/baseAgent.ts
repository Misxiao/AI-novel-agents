import type { ChatModel } from "./types.js";

export interface BaseAgentRuntime {
  model?: ChatModel;
  now?: () => Date;
  createModel?: () => ChatModel | Promise<ChatModel>;
}

export abstract class BaseAgent {
  abstract readonly id: string;
  abstract readonly name: string;

  private model?: ChatModel;
  private readonly now?: () => Date;
  private readonly createModel?: () => ChatModel | Promise<ChatModel>;

  protected constructor(runtime: BaseAgentRuntime = {}) {
    this.model = runtime.model;
    this.now = runtime.now;
    this.createModel = runtime.createModel;
  }

  protected async getModel(): Promise<ChatModel> {
    if (!this.model) {
      this.model = this.createModel ? await this.createModel() : await createDefaultModel();
    }

    return this.model;
  }

  protected getNow() {
    return this.now?.() ?? new Date();
  }
}

async function createDefaultModel(): Promise<ChatModel> {
  const llmModulePath = "../../../llm/src/index.js";
  const llmModule = (await import(llmModulePath)) as {
    createDefaultChatModel: () => ChatModel;
  };

  return llmModule.createDefaultChatModel();
}
