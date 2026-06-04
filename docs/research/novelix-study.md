# novelix 调研与项目内化记录

## 来源

- 仓库：`https://github.com/zxerai/novelix`
- 本地位置：`/Users/yaokangjing/Documents/projects/novelix`
- 项目内统一入口：`external/learning-sources/novelix`
- 观察日期：2026-06-04
- 授权状态：仓库包含 `LICENSE`，`package.json` 标记为 `AGPL-3.0-only`

## 结构观察

`novelix` 是一个自动化小说写作 CLI Agent 与 Web 工作台项目。它的核心价值不在单个 Prompt，而在长篇小说生产链路、状态治理、审计闭环和工具化工作台。

本地目录中值得后续优先阅读的位置：

- `packages/core/src/agents/`：规划、写作、审计、修订、观察、状态校验、风格分析等 Agent 实现。
- `packages/core/src/pipeline/`：章节生产、审阅循环、状态恢复、调度和持久化流程。
- `packages/core/src/state/`：状态管理、记忆数据库、状态投影和 reducer。
- `packages/core/src/models/`：书籍、章节、运行态、风格、长度治理等模型定义。
- `packages/core/src/utils/memory-retrieval.ts`：记忆检索策略。
- `packages/core/src/utils/context-assembly.ts`：上下文组装策略。
- `packages/core/src/agent/`：自然语言控制与工具调用层。
- `skills/SKILL.md`：作为 Skill 暴露时的工作流说明。

避免默认读取的位置：

- `.novelix/secrets.json`：可能包含本地密钥或敏感配置，后续调研不要读取。
- `.novelix/sessions/`：本地会话记录，除非用户明确要求分析，不作为默认学习材料。
- 已生成小说正文或导出文本：只作功能形态观察，不复制内容。

## 可学习方向

`novelix` 的 README 与 Skill 说明中明确提出：

- 10 Agent 管线：雷达、规划师、编排师、建筑师、写手、观察者、反射器、归一化器、审计员、修订者。
- 三阶段章节生产：创意写作、状态结算、质量循环。
- 真相文件或状态文件：维护世界状态、资源账本、伏笔池、章节摘要、支线、情绪弧线和角色矩阵等长期一致性资产。
- 章节前置治理：作者意图、当前焦点、章节意图和运行上下文分层。
- 审计与修订闭环：章节生成后进入连续性、节奏、伏笔、字数等质量检查，再由修订能力修复。
- 多模型路由：不同 Agent 可以使用不同模型。
- 自然语言控制层：把用户自然语言转成工具调用和项目状态变更。
- Web 工作台：用于书籍、章节、审阅、数据分析和进度管理。

## 对本项目的启发

本项目不应直接照搬 `novelix` 的 Agent 划分，但可以吸收以下设计：

- 章节生产 Workflow 应明确拆成“检索上下文、生成章纲或章节意图、生成正文、评审、修订、确认后写入记忆”。
- 记忆层可以参考“真相文件 + 检索数据库 + 人类可读投影”的组合，但必须继续保持所有资产绑定 `novelId`。
- 评审 Agent 应形成结构化问题输出，并把问题映射到正文、章纲、角色、设定、伏笔、节奏等责任模块。
- Workflow 层需要记录运行态、恢复点、失败原因和可重试步骤，而不是只保存最终文本。
- 前端可以后续参考 Studio 的“审阅、统计、章节进度”形态，但当前阶段仍优先建设 `packages/agents` 和 `packages/workflow`。

## 不直接内置的内容

- 不复制 `novelix` 的 AGPL 代码到本项目，除非后续明确处理许可证兼容性。
- 不复制本地 `.novelix` 会话、密钥、生成正文或导出作品。
- 不把 `novelix` 的多模型路由做成用户可配置的 Agent 配置界面；本项目仍坚持 Agent、Prompt、Skill 和 Workflow 为内置能力。

## 后续调研任务

- 阅读 `packages/core/src/pipeline/runner.ts` 和 `chapter-review-cycle.ts`，提炼章节 Workflow 的状态机设计。
- 阅读 `packages/core/src/state/manager.ts`、`state-reducer.ts` 和 `memory-db.ts`，评估本项目 `packages/memory` 的状态写入与检索边界。
- 阅读 `packages/core/src/agents/continuity.ts`、`reviser.ts`、`post-write-validator.ts`，补强本项目评审 Agent 的问题分类和修订闭环。
- 阅读 `packages/core/src/utils/context-assembly.ts` 和 `governed-working-set.ts`，为本项目章节 Agent 的上下文预算与素材选择提供参考。

## 已落地文件

当前仅完成学习源登记和初步调研记录。后续内化实现应优先落在：

- `packages/agents/src/`
- `packages/workflow/src/`
- `packages/memory/src/`
- `docs/ai/`
- `docs/architecture/`
