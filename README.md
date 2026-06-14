# AI 小说 Agent 创作平台

本地优先的中文网文创作 Agent 平台，面向多小说、长篇连载的完整创作闭环。当前阶段以 **CLI 向导式工作台** 为唯一入口，从立项、设定、大纲一路到逐章生产、评审、确认与长篇记忆维护，全程在终端完成。

> 当前重心是 Agent 能力、自有 Workflow 编排和长篇记忆闭环。`apps/web`、`apps/api` 暂不维护，可视为不存在。

## 快速开始

1. 安装依赖：

   ```bash
   pnpm install
   ```

2. 配置模型（项目根目录 `.env`，可参考 `.env.example`）：

   ```bash
   DEEPSEEK_API_KEY=你的 DeepSeek API Key
   DEEPSEEK_MODEL=deepseek-v4-flash      # 默认档位
   # 可选：按任务档位分别指定模型（格式 provider:model）
   LLM_PLAN_MODEL=deepseek:deepseek-v4-flash    # 规划/大纲
   LLM_PROSE_MODEL=deepseek:deepseek-v4-pro      # 正文
   LLM_REVIEW_MODEL=deepseek:deepseek-v4-flash   # 评审/记忆
   ```

3. 启动工作台：

   ```bash
   pnpm cli            # 真实模型
   pnpm cli:mock       # 离线演练（本地固定响应，不消耗额度）
   ```

## 工作台怎么用

进入后选择或新建小说，仪表盘会显示当前进度并给出 **下一步建议**，回车即执行，或上下键选择其他动作：

```
《噬星者》 连载中 · 已确认 36 章 · 下一章 第 37 章 · 伏笔待回收 2 · 1.2M tokens
★ 确认第 37 章草稿（评分 8.4，一致性通过）   ← 回车执行
  写下一章 / 修改基础盘·设定 / 修改大纲 / 修改章节 / 资料库 / 切换小说 / 退出
```

平台自动驱动整条创作链：

```
新建小说 → 生成基础盘 → 生成设定 → 生成总纲 → 生成卷纲
        → 逐章：装配上下文 → 章纲 → 流式写正文 → 评审+六层一致性 → 按需修订
        → 确认：提取记忆（人物状态/伏笔/canon/摘要）→ 写入台账 → 滚动维护卷摘要与前情提要
```

所有 AI 资产都有三条修改通道：**指令式 AI 修改**、**手工 `$EDITOR` 编辑**、台账类（伏笔/人物/canon）**表单式手工修正**（资料库面板）。长流程实时流式显示正文与进度，崩溃后可在仪表盘断点续跑。

## 工程结构

| 包 | 职责 |
| --- | --- |
| `packages/llm` | ChatModel 接口、DeepSeek 流式接入、重试退避、按档位模型路由 |
| `packages/store` | SQLite 持久化与长篇记忆：资产/大纲/章节草稿、伏笔台账、人物状态链、摘要链、canon、运行检查点；上下文装配 v2 |
| `packages/agents` | 原子能力（capability）体系与注册表：inspiration/setting/outline/plan/writer/reviewer/memory；范文语料检索 |
| `packages/workflow` | 自有步骤引擎（检查点/断点恢复/事件）+ 8 条创作 workflow |
| `packages/cli` | `@clack/prompts` 向导式工作台 |
| `packages/db` | （遗留）旧 SQLite 层，仅 `apps/api` 仍依赖 |

`agents` 与 `workflow` 各自导出可枚举、自描述的能力/流程注册表，为后续对话式 director agent 预留接口。

## 开发

```bash
pnpm typecheck      # 检查全部 packages
pnpm test           # 运行全部 packages 测试（node:test）
```

不使用 LangGraph，Workflow 统一用项目内自有 TypeScript 步骤引擎。所有面向用户与开发者的文案使用中文。
