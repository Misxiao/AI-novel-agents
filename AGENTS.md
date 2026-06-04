# AGENTS.md

## 项目定位

这是一个本地优先的中文网文创作 Agent 管理平台。平台以 Web 方式管理多个小说项目，每本小说拥有独立记忆、独立创作资产、独立任务历史和独立质量报告。

本项目不是 Prompt/Skill 配置平台。Agent、Prompt、Skill 模块、工具权限和 Workflow 均为项目内置能力，由代码和测试维护，不在前端暴露配置入口。

## 技术边界

- 前端使用 Vite + React。
- 后端使用 Fastify。
- Agent 编排不再使用 LangGraph.js，改为项目内自有 Workflow 层串联独立 Agent 能力。
- 语言使用 TypeScript。
- 数据存储以本地优先为原则，默认从 SQLite 设计起步。
- 多小说隔离是核心约束，任何记忆、检索、任务、章节、角色和设定都必须绑定 `novelId`。

## 工程约定

- 所有项目文档必须使用中文。后续新增、修改、重构或迁移任何文档时，都必须保持中文表达；除非是在引用外部 API 名称、代码标识符、命令、包名或不可翻译的专有名词。
- 面向开发者的说明、架构设计、PRD、规格文档、研究记录、Agent 工作流说明和 README 默认都属于项目文档，必须遵守中文文档约定。
- PRD 存放在 `docs/prds/` 下。
- 技术设计文档存放在 `docs/architecture/` 下。
- 不要把可变的 Agent 配置做成用户界面功能。
- 不要把用户正在创作的小说内容、参考语料、阅读数据混入全局记忆。
- 不要在没有明确需求时加入云端依赖；优先保持本地可运行。
- 中文网文写作专项逻辑内置在 `packages/agents/src/webnovelSkill/`，素材包放在 `packages/agents/resources/webnovel-skill/`。这些内容属于系统能力，不提供前端配置入口。
- 外部写作语料必须先确认授权再导入。未确认授权的长文本语料只能作为外部来源索引记录，不得默认复制进项目作为内置语料。
- 外部开源项目、Skill、论文或资料库作为学习源时，统一登记在 `docs/research/external-learning-sources.md`，本地源码镜像放在 `external/learning-sources/`。该目录仅用于查阅和调研，不作为本项目源码或内置素材提交。
- 当前阶段优先建设可独立运行的 Agent 层和 Workflow 层。新增或修改 Agent/Workflow 能力时，默认只改 `packages/agents`、`packages/workflow` 及相关说明文档；不要同步修改 `apps/web`、`apps/api` 或接口接入层。等 Agent/Workflow 独立验证稳定后，再单独规划 Web/API 接入。

## 推荐工作方式

实现功能前先阅读：

- `docs/prds/local-novel-agent-platform/prd.md`
- `docs/prds/local-novel-agent-platform/agent-system.prd.md`
- `docs/architecture/system-architecture.md`
- `docs/ai/agent-architecture.md`
- `docs/architecture/technical-design.md`
- `docs/architecture/project-structure.md`

如果任务涉及 Agent、Workflow、中文网文生成、章节正文、章纲、大纲、评审、记忆、检索或写作素材包，还必须先阅读：

- `docs/research/external-learning-sources.md`

然后按索引阅读相关调研记录和 `external/learning-sources/` 下的本地学习源。优先吸收架构、流程、模块边界、检索方法和质量评审思路；未经授权确认，不要复制外部仓库中的长文本语料、示例正文或大段 Prompt。

新增代码时优先保持模块边界：

- `apps/web` 只负责管理平台 UI。
- `apps/api` 只负责 HTTP/SSE API、鉴权边界、任务入口和服务组合。
- `packages/agents` 只负责 Agent 定义、能力契约、Prompt 组织和能力执行。
- `packages/domain` 只负责领域模型与业务规则。
- `packages/memory` 只负责小说记忆、摘要、检索与 canon 管理。
- `packages/workflow` 只负责任务状态、运行记录、重试和恢复。

处理中文网文生成、评审或修改时，优先使用 `packages/agents/src/webnovelSkill/router.ts` 的路由逻辑，再读取对应模块定义和素材包。

Agent 分工遵循 `docs/ai/agent-architecture.md`，但当前正文方向采用 `chapter` 章节 Agent 承接章节正文相关能力。不要新增顶层“生成 Agent”或“修改 Agent”；大纲相关的整书、分卷、章纲生成与修改仍归入 `outline` 大纲 Agent。
