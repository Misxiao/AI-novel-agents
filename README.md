# AI 小说 Agent 管理平台

本项目是一个本地优先的中文网文创作 Agent 管理平台，面向多小说、多 Agent、多记忆域的长期创作工作流。

当前阶段的长期开发重心是 Agent 底层能力、项目自有 Workflow、小说记忆和本地资产闭环。除非明确进入接入阶段，默认不改 `apps/web` 和 `apps/api`。

文档入口见 `docs/README.md`，核心开发约定见 `docs/architecture/development-handbook.md`。后续核心工作流不使用 LangGraph.js，统一沿用项目内自有 TypeScript Workflow 编排模式。

## 本地开发

安装依赖后，在项目根目录运行：

```bash
pnpm dev
```

该命令会同时启动前端和后端服务。后端默认监听 `API_PORT=4100`，前端 Vite 开发服务器会把 `/api` 请求代理到同一个后端端口。

## 本地模型配置

项目根目录提供 `.env.example` 作为环境变量模板，真实密钥写入本地 `.env`。`.env` 已被 `.gitignore` 排除，不应提交到仓库。

当前 DeepSeek V4 基础接入读取以下变量：

```bash
LLM_PROVIDER=deepseek
DEEPSEEK_API_KEY=你的 DeepSeek API Key
DEEPSEEK_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

`DEEPSEEK_MODEL` 可按需要改为 `deepseek-v4-pro`。后端或 Agent 进程启动前需要加载这些环境变量。

## 小说创作 CLI

统一 CLI 位于 `packages/agent-cli`。开发态启动：

```bash
pnpm --filter @ai-novel-agents/agent-cli demo
```

无参数时进入交互工作台：

```text
AI 小说创作工作台。输入 help 查看命令，输入 exit 退出。
ai-novel[未选择]> novel create
ai-novel[novel-...]> novel update --title "裂界回声"
ai-novel[裂界回声]> help outline
```

也可以一次执行一条命令：

```bash
pnpm --filter @ai-novel-agents/agent-cli demo help
pnpm --filter @ai-novel-agents/agent-cli demo novel list
pnpm --filter @ai-novel-agents/agent-cli demo novel create --json
pnpm --filter @ai-novel-agents/agent-cli demo preflight run \
  --novel-id=novel-xxx \
  --seed-notes="主角必须在失忆前关闭裂界" \
  --target-words=120000 \
  --mock
```

主要命令分组：

- `novel`：列表、创建、查看、切换和修改小说基础信息。
- `preflight`：生成基础盘、设定、总纲、卷纲和首批章纲。
- `asset`：查看前置资产草案。
- `outline`：查看大纲、版本历史以及修改总纲或卷纲。
- `task`：查看 Workflow 任务历史。
- `chapter`：运行单章生产和质量评审 Workflow。

在交互模式中，`novel use <novelId>` 选择的当前小说只在本次会话内有效。所有 AI 命令默认读取 `.env` 中的真实模型配置；显式传入 `--mock` 可使用本地固定模型响应进行验证。

生成或修改大纲后，运行 `outline confirm` 将前置资产与选中的大纲版本写入正式资产；确认完成后，`chapter write` 才会读取这些章纲、世界规则和风格约束。
