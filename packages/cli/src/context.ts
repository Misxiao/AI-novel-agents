import type { ModelRouter } from "@ai-novel-agents/llm";
import type { Store } from "@ai-novel-agents/store";

export interface AppContext {
  store: Store;
  models: ModelRouter;
  mock: boolean;
  /** 当前选中的小说 id（由主循环在选择后设置） */
  currentNovelId: string;
}
