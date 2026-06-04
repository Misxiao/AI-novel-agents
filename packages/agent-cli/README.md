# Agent CLI 实验包

本包用于在不经过 `apps/web` 和 `apps/api` 的情况下，直接运行项目内置 Agent 能力。当前先提供 `chapter` Agent 的本地演示脚本，后续可演进为正式 CLI。

## 运行 Mock 演示

```bash
pnpm --filter @ai-novel-agents/agent-cli demo -- --mock
```

## 运行真实模型

先在项目根目录 `.env` 配置：

```bash
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-v4-flash
```

然后运行：

```bash
pnpm --filter @ai-novel-agents/agent-cli demo -- write
```

## 可用命令

```bash
pnpm --filter @ai-novel-agents/agent-cli demo -- plan
pnpm --filter @ai-novel-agents/agent-cli demo -- write
pnpm --filter @ai-novel-agents/agent-cli demo -- revise
pnpm --filter @ai-novel-agents/agent-cli demo -- rewrite-scene
pnpm --filter @ai-novel-agents/agent-cli demo -- expand --target-words=3200
pnpm --filter @ai-novel-agents/agent-cli demo -- compress --target-words=1200
pnpm --filter @ai-novel-agents/agent-cli demo -- polish
```

追加 `--mock` 可离线查看结构，追加 `--json` 可输出完整 JSON。

