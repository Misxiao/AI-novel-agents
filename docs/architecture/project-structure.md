# 项目结构说明

```txt
AI-novel-agents/
  apps/
    web/
      src/
    api/
      src/
  packages/
    agents/
      resources/
        webnovel-skill/
      src/
        agents/
        core/
        webnovelSkill/
    domain/
      src/
    db/
      src/
    llm/
      src/
    memory/
      src/
    workflow/
      src/
    shared/
      src/
  docs/
    prds/
      local-novel-agent-platform/
        prd.md
    architecture/
      technical-design.md
      project-structure.md
    ai/
    specs/
    research/
  external/
    learning-sources/
  AGENTS.md
  README.md
```

## 目录职责

- `apps/web`：Web 管理平台。
- `apps/api`：Fastify API 服务。
- `packages/agents`：Agent 定义、能力契约、Prompt 组织和能力执行。
- `packages/agents/src/core`：Agent 类型、能力契约和注册表。
- `packages/agents/src/agents`：独立 Agent 定义和具体能力实现。
- `packages/agents/src/webnovelSkill`：中文网文专项模块定义、路由逻辑和 Prompt 上下文构造。
- `packages/agents/resources/webnovel-skill`：中文网文写作内置素材包、模块索引和外部语料源索引。
- `packages/domain`：领域模型。
- `packages/db`：数据库与 repository。
- `packages/llm`：模型供应商抽象。
- `packages/memory`：小说独立记忆。
- `packages/workflow`：项目自有 Workflow 编排层，串联独立 Agent 能力；当前阶段先独立验证，不默认接入 Web/API。
- `packages/shared`：共享类型与工具。
- `docs/prds`：PRD 文档。
- `docs/architecture`：技术设计。
- `docs/ai`：AI 协作与 Agent 说明。
- `docs/specs`：后续规格设计。
- `docs/research`：调研记录。
- `external/learning-sources`：外部开源项目、Skill、论文配套代码或资料库的本地学习源镜像；该目录仅用于查阅和调研，默认不提交到仓库。
