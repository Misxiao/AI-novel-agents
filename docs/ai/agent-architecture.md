# 多 Agent 架构设计文档

## 1. 文档目的

本文档用于指导后续 AI 与开发者实现项目内置 Agent 系统。它定义 Agent 的分工、子能力、文件结构、记忆边界和工作流关系。

本项目不把 Agent 做成前端可配置对象。Agent 是系统内置能力，由代码、文档和测试维护。

## 2. 核心原则

1. Agent 是角色，不是单一功能。
2. 能力是 Agent 下的可调用子功能。
3. 生成、修改、扩写、压缩和润色都属于正文 Agent。
4. 大纲 Agent 既能生成整书大纲，也能修改整书、单卷、单章纲。
5. 评审 Agent 不直接改正文，只输出问题、责任模块和建议。
6. 记忆 Agent 不接收未确认草稿进入 canon。
7. 所有小说私有数据必须绑定 `novelId`。

## 3. Agent 总览

| Agent | 职责 | 主要子能力 |
| --- | --- | --- |
| 灵感 Agent | 选题、点子扩展、卖点发掘 | 灵感发散、点子评估、书名简介候选 |
| 总编/调度 Agent | 流程选择、任务编排、人工确认点 | 创建基础盘、规划下一步、协调工作流 |
| 大纲 Agent | 总纲、分卷、章纲生成与修改 | 整书大纲生成/修改、分卷生成/修改、章纲生成/修改 |
| 正文 Agent | 正文生成与修改 | 章节生成、章节修改、场景重写、扩写、压缩、风格处理 |
| 评审 Agent | 大纲和正文质量检查 | 章节评审、大纲评审、一致性评审、风格评审 |
| 记忆 Agent | 小说独立记忆维护 | 上下文检索、canon 提取、记忆更新 |
| 数据分析 Agent | 后续阅读数据分析 | 数据导入、表现分析、内容调整建议 |

## 4. 文件结构

```txt
packages/agents/src/
  core/
    types.ts
    registry.ts
    index.ts
  agents/
    inspiration/
      definition.ts
    director/
      definition.ts
    outline/
      definition.ts
    prose/
      definition.ts
    review/
      definition.ts
    memory/
      definition.ts
    analytics/
      definition.ts
    index.ts
  graphs/
    novelIntake/
      index.ts
    outlinePlanning/
      index.ts
    proseProduction/
      index.ts
    chapterReview/
      index.ts
    memoryUpdate/
      index.ts
    index.ts
  webnovelSkill/
    router.ts
    moduleDefinitions.ts
    chains.ts
    types.ts
```

## 5. Agent 与能力模型

Agent 定义位于 `packages/agents/src/agents/*/definition.ts`。

每个 Agent 必须声明：

- `id`：稳定标识。
- `name`：中文名称。
- `role`：角色定位。
- `responsibility`：职责说明。
- `owns`：该 Agent 拥有和产出的资产。
- `doesNotOwn`：明确不由该 Agent 修改的资产。
- `memoryPolicy`：记忆读取和写入规则。
- `capabilities`：该 Agent 的子能力。

能力定义必须声明：

- 输入作用域。
- 输出作用域。
- 读取资源。
- 写入资源。
- 是否需要人工确认。

## 6. 正文 Agent 边界

正文 Agent 是正文生产的唯一入口。后续不要再新建独立的“生成 Agent”或“修改 Agent”作为顶层 Agent。

正文 Agent 子能力包括：

- `prose.draftChapter`：生成章节正文。
- `prose.reviseChapter`：修改章节正文。
- `prose.rewriteScene`：重写场景。
- `prose.expandText`：扩写正文。
- `prose.compressText`：压缩正文。
- `prose.polishStyle`：风格处理。

正文 Agent 可以读取章纲、小说记忆、角色状态和写作素材包，但不得直接写入 canon。正文被用户确认后，交由记忆 Agent 提取和更新记忆。

## 7. 大纲 Agent 边界

大纲 Agent 不是只做一次性大纲生成。它管理从整书到单章纲的结构资产。

大纲 Agent 子能力包括：

- `outline.generateBookOutline`：生成整书大纲。
- `outline.reviseBookOutline`：修改整书大纲。
- `outline.generateVolumeOutline`：生成分卷大纲。
- `outline.reviseVolumeOutline`：修改分卷大纲。
- `outline.generateChapterPlans`：批量生成章纲。
- `outline.reviseChapterPlan`：修改单章章纲。

大纲 Agent 不直接写章节正文。章纲一旦被用户确认，可以交由正文 Agent 生成正文。

## 8. 推荐工作流

### 8.1 小说立项

```txt
inspiration.brainstorm
-> inspiration.evaluateIdea
-> inspiration.generateTitles
-> director.createNovelFoundation
-> memory.updateNovelMemory
```

### 8.2 大纲生产

```txt
outline.generateBookOutline
-> review.reviewOutline
-> outline.generateVolumeOutline
-> outline.generateChapterPlans
-> memory.extractCanon
```

### 8.3 正文生产

```txt
memory.retrieveContext
-> prose.draftChapter
-> review.reviewChapter
-> prose.reviseChapter
-> review.reviewConsistency
-> memory.extractCanon
-> memory.updateNovelMemory
```

### 8.4 阅读数据反馈

```txt
analytics.importReaderData
-> analytics.analyzeReaderData
-> analytics.suggestContentAdjustment
-> director.planNextAction
```

## 9. 与中文网文专项模块关系

正文 Agent、评审 Agent 和大纲 Agent 在处理中文网文任务时，应优先调用：

- `packages/agents/src/webnovelSkill/router.ts`
- `packages/agents/src/webnovelSkill/moduleDefinitions.ts`
- `packages/agents/resources/webnovel-skill/`

专项模块负责判断具体问题属于开头、章纲、剧情逻辑、人物一致性、转场、对白、章末、去 AI 味还是一致性审查。

## 10. 后续实现要求

- LangGraph 节点应该调用 Agent capability，而不是绕过 Agent 直接写业务逻辑。
- 每个 capability 的输入输出应逐步升级为 Zod schema 或等价结构化 schema。
- 所有写入小说资产的能力都必须记录 Agent Run。
- 需要人工确认的 capability 不得直接覆盖正式资产。
- 任何跨小说读取必须显式禁止，除非读取的是全局模板或全局素材包。

