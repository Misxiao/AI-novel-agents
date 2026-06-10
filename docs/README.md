# 项目文档索引

项目文档按“产品需求、系统设计、开发状态、外部研究”四类维护。相同信息只保留一个权威来源，其他文档通过链接引用，不重复展开。

## 必读入口

| 任务 | 阅读文档 |
| --- | --- |
| 了解产品目标和边界 | `prds/local-novel-agent-platform/prd.md` |
| 修改系统分层、模块边界或数据流 | `architecture/system-architecture.md` |
| 修改 Agent 职责、能力契约或工作流 | `ai/agent-architecture.md` |
| 修改 Agent 运行层、上下文装配或工具边界 | `architecture/agent-layer-technical-design.md` |
| 了解当前开发约束 | `architecture/development-handbook.md` |
| 了解已实现能力和后续优先级 | `architecture/development-roadmap.md` |
| 修改小说基础信息产品能力 | `prds/local-novel-agent-platform/novel-foundation.prd.md` |
| 修改大纲、时间线或伏笔能力 | `prds/local-novel-agent-platform/outline-planning.prd.md` |
| 使用外部学习源 | `research/external-learning-sources.md` |

局部代码修改只需阅读 `AGENTS.md`、目标文件和直接依赖，不要求预读全部文档。

## 权威来源

- 产品目标、用户场景和非目标：总 PRD 与专项 PRD。
- 系统分层、模块职责、数据流和本地优先原则：系统架构。
- Agent 分工、能力归属和工作流关系：Agent 架构。
- 当前实现状态、缺口和开发顺序：开发路线图。
- 日常协作、验证方式和改动范围：开发手册与根目录 `AGENTS.md`。
- 外部资料授权和内化规则：外部学习源索引。

## 文档维护规则

1. 小型代码改动不创建设计文档、规格文档或实施计划。
2. 只有跨模块架构变更、新产品能力或用户明确要求时，才新增文档。
3. 新文档必须说明它替代或补充哪个权威来源。
4. 实现状态只写入开发路线图，不在多个架构文档重复维护。
5. 过时文档直接合并或删除，不保留仅供过程追踪的一次性文档。
6. 所有项目文档使用中文，代码标识符、命令和专有名词除外。
