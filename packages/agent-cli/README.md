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

也可以直接运行预设章节工作流测试。它内置了一组“都市异能悬疑”前置条件，不依赖 SQLite 小说项目，但会真实调用模型：

```bash
pnpm --filter @ai-novel-agents/agent-cli test:write-workflow
```

可追加少量覆盖参数：

```bash
pnpm --filter @ai-novel-agents/agent-cli test:write-workflow -- --target-words=1600 --json
```

如果不想依赖真实 SQLite 小说项目，可以用 CLI 输入一组临时前置条件。此模式会使用内存 mock 上下文，但模型调用仍是真实的 DeepSeek：

```bash
pnpm --filter @ai-novel-agents/agent-cli demo -- write \
  --mock-context \
  --novel-title=雾都回声 \
  --genre=都市异能 \
  --novel-hook=主角能听见城市里死者留下的回声。 \
  --chapter-no=3 \
  --chapter-title=地铁里的第二声 \
  --chapter-objective=主角确认第二个回声来自同一名凶手。 \
  --chapter-hook=他听见自己的名字从隧道深处传来。 \
  --previous-summary=主角第一次发现回声不是幻觉。 \
  --next-objective=主角追查地铁站旧案。 \
  --canon-fact=主角已经听见过第一段死者回声。 \
  --canon-fact=回声只能在案发地点附近出现。 \
  --world-rule=回声不会直接说出凶手姓名。 \
  --style-guidance=短段落，冷硬，动作优先。 \
  --forbidden-expression=命运的齿轮开始转动 \
  --intent=这一章要更悬疑，章末要强钩子。 \
  --target-words=2200
```

追加 `--json` 可以查看完整 `initialDraft`、`finalDraft`、`reviewReports`、`revisionHistory` 和 `qualityGate`。追加 `--mock` 则会改成离线假模型，适合只看流程结构，不代表真实生成质量。

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
