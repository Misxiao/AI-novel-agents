import { createModelRouter } from "@ai-novel-agents/llm";
import { openStore } from "@ai-novel-agents/store";

import { runApp } from "./app.js";
import type { AppContext } from "./context.js";
import { createMockRouter } from "./mock/mockModels.js";
import { color, loadEnv } from "./util.js";

async function main(): Promise<void> {
  const mock = process.argv.includes("--mock");
  const repoRoot = new URL("../../..", import.meta.url).pathname;
  loadEnv(repoRoot);

  const store = openStore();
  const models = mock ? createMockRouter() : createModelRouter();

  if (!mock && !process.env.DEEPSEEK_API_KEY) {
    process.stdout.write(
      color.yellow(
        "未检测到 DEEPSEEK_API_KEY。请在项目根目录 .env 配置，或加 --mock 进入离线演练模式。\n",
      ),
    );
    process.exit(1);
  }

  const ctx: AppContext = { store, models, mock, currentNovelId: "" };
  try {
    await runApp(ctx);
  } finally {
    store.close();
  }
}

main().catch((error) => {
  process.stderr.write(color.red(`\n出错了：${error instanceof Error ? error.message : String(error)}\n`));
  process.exit(1);
});
