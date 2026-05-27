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
  AGENTS.md
  README.md
```

## 目录职责

- `apps/web`：Web 管理平台。
- `apps/api`：Fastify API 服务。
- `packages/agents`：LangGraph Agent 工作流。
- `packages/agents/src/webnovelSkill`：中文网文专项模块定义、路由逻辑和 Prompt 上下文构造。
- `packages/agents/resources/webnovel-skill`：中文网文写作内置素材包、模块索引和外部语料源索引。
- `packages/domain`：领域模型。
- `packages/db`：数据库与 repository。
- `packages/llm`：模型供应商抽象。
- `packages/memory`：小说独立记忆。
- `packages/workflow`：任务运行与恢复。
- `packages/shared`：共享类型与工具。
- `docs/prds`：PRD 文档。
- `docs/architecture`：技术设计。
- `docs/ai`：AI 协作与 Agent 说明。
- `docs/specs`：后续规格设计。
- `docs/research`：调研记录。
