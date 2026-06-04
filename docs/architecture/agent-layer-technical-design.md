# Agent 层技术方案

## 1. 设计目标

Agent 层是本项目的创作能力核心，负责把小说资产、上下文、中文网文专项规则和模型调用组织成可追踪、可恢复、可评审的生产流程。

本方案的目标不是把 Agent 做成前端可配置平台，而是建立一套稳定的工程边界：

1. 前端只触发业务任务，不理解 Agent、Prompt、Skill 或 LangGraph 节点。
2. API 只负责请求校验、任务创建、进度推送和服务组合，不直接拼接复杂 prompt。
3. Workflow 负责任务生命周期、恢复、重试和人工确认点。
4. Agent 层负责 capability 执行、上下文装配、模型调用、工具调用、结构化输出和运行记录。
5. 数据库是小说资产的权威存储，LLM 输出先成为草案或补丁，用户确认后才进入正式资产或 canon。

## 2. 总体分层

```txt
apps/web
  -> apps/api
    -> packages/workflow
      -> packages/agents/src/graphs
        -> packages/agents/src/runtime
          -> packages/agents/src/capabilities
            -> packages/agents/src/webnovelSkill
            -> packages/memory
            -> packages/llm
            -> ToolRuntime / MCP
```

Agent 层内部建议按以下职责分开：

```txt
packages/agents/
  src/
    core/              # Agent、Capability、运行事件和契约类型
    agents/            # 七类顶层 Agent 的静态定义
    capabilities/      # 各 capability 的实际执行逻辑，后续新增
    graphs/            # LangGraph 工作流定义和节点编排
    runtime/           # AgentHarness、ContextAssembler、ToolRuntime 等运行时
    schemas/           # 输入输出 Zod schema 或等价结构化 schema，后续新增
    webnovelSkill/     # 中文网文专项模块路由、模块定义和链路规则
  resources/
    webnovel-skill/    # 内置素材包、模块索引、授权来源索引
```

`capabilities/`、`schemas/` 和通用 `runtime/` 已作为 Agent 层基础结构落地。现有 `runtime/outlineFirstGeneration.ts` 保留为兼容 facade，内部转调 `outlinePlanning` LangGraph；首次大纲生成的实际能力位于 `capabilities/outline/generateBookOutline.ts`。

## 3. 调用关系

### 3.1 标准任务链路

```txt
前端业务动作
-> API 校验 novelId 和请求体
-> WorkflowRunner 创建 WorkflowTask
-> Graph Runner 执行 LangGraph 工作流
-> AgentHarness.invoke(capabilityId, input)
-> ContextAssembler 读取资产、记忆、素材和检索结果
-> Capability 编译 prompt / 工具计划
-> LLM Provider 或 ToolRuntime / MCP
-> OutputParser 校验结构化输出
-> Review / Guardrails 校验
-> 返回草案、补丁、评审报告或待确认动作
-> Workflow 记录任务、AgentRun、资产版本
-> API / SSE 返回给前端
```

### 3.2 禁止的调用方向

Agent 层不得直接依赖 `apps/api` 或 `apps/web`。

`packages/agents` 不应直接持有具体 SQLite repository 实例。需要读取小说资产时，通过运行时注入的接口获取，例如 `NovelAssetReader`、`MemoryRetriever`、`RunRecorder`。

Capability 不应直接覆盖正式资产。正式写库由 Workflow 或 Repository 层在 schema 校验和人工确认后执行。

`webnovelSkill` 不应调用 LLM、数据库或 MCP。它只提供模块定义、路由决策、链路规则和 prompt 上下文片段。

## 4. 目录职责

### 4.1 `src/core`

`core` 是 Agent 层的基础契约层。

职责：

- 定义 `AgentId`、`CapabilityId`、`AgentDefinition`、`CapabilityContract`。
- 定义后续通用运行类型，例如 `AgentInvocation`、`AgentRunEvent`、`CapabilityResult`。
- 提供 Agent 注册表和 capability 查询能力。

依赖规则：

- 可以被 `agents/`、`graphs/`、`runtime/`、`capabilities/` 引用。
- 不应引用具体 Agent 实现之外的业务运行逻辑。
- 不应依赖 `packages/llm`、`packages/db` 或 `apps/*`。

当前建议：

- 保留现有 `types.ts` 和 `registry.ts`。
- 后续把 capability 的输入输出 schema id、默认工作流、是否允许工具调用、是否需要人工确认补入契约。

### 4.2 `src/agents`

`agents` 是静态 Agent 定义层，不是执行层。

职责：

- 声明七类顶层 Agent：`director`、`inspiration`、`outline`、`prose`、`review`、`memory`、`analytics`。
- 描述每个 Agent 的职责、资产归属、不可写资产、记忆策略和 capability 列表。
- 作为架构可读性和权限边界来源。

依赖规则：

- 可以引用 `core` 类型。
- 不应调用 LLM。
- 不应读取数据库。
- 不应包含 prompt 拼接、JSON 解析或业务运行代码。

当前建议：

- 保留现有目录结构。
- 不新增顶层“生成 Agent”或“修改 Agent”。
- 正文生成、重写、扩写、压缩、润色都归入 `prose`。
- 整书、分卷、章纲生成与修改都归入 `outline`。

### 4.3 `src/capabilities`

`capabilities` 是能力实现层。

职责：

- 每个 capability 一个可测试的执行单元。
- 接收 `AgentInvocationContext`，返回结构化草案、补丁、评审报告或工具请求。
- 只处理该 capability 的业务逻辑，不管理任务生命周期。

建议结构：

```txt
src/capabilities/
  outline/
    generateBookOutline.ts
    reviseBookOutline.ts
    generateVolumeOutline.ts
    reviseVolumeOutline.ts
    generateChapterPlans.ts
    reviseChapterPlan.ts
  prose/
    draftChapter.ts
    reviseChapter.ts
    rewriteScene.ts
    expandText.ts
    compressText.ts
    polishStyle.ts
  review/
    reviewChapter.ts
    reviewOutline.ts
    reviewConsistency.ts
    reviewStyle.ts
  memory/
    retrieveContext.ts
    extractCanon.ts
    updateNovelMemory.ts
```

依赖规则：

- 可以引用 `core`、`runtime` 的接口、`webnovelSkill`、`schemas` 和 `packages/llm` 抽象类型。
- 不直接引用 `apps/api`。
- 不直接写正式资产。

当前迁移建议：

- 将 `runtime/outlineFirstGeneration.ts` 中的 prompt 编译、模型调用、输出解析和 normalize 逻辑逐步拆入 `capabilities/outline/generateBookOutline.ts`。
- `runtime` 只保留通用执行器，不保留具体业务能力实现。

### 4.4 `src/graphs`

`graphs` 是工作流编排层，后续承载 LangGraph.js 实现。

职责：

- 定义业务工作流的节点顺序、条件分支、失败处理和人工确认点。
- 节点只调用 Agent capability，不绕过 Agent 直接写业务逻辑。
- 将多步骤任务编排成可恢复的图。

核心图：

```txt
novelIntake
outlinePlanning
proseProduction
chapterReview
chapterRevision
memoryUpdate
```

章节生产推荐图：

```txt
memory.retrieveContext
-> prose.draftChapter
-> review.reviewChapter
-> prose.reviseChapter
-> review.reviewConsistency
-> waiting_for_user
-> memory.extractCanon
-> memory.updateNovelMemory
```

大纲规划推荐图：

```txt
memory.retrieveContext
-> outline.generateBookOutline
-> review.reviewOutline
-> outline.generateVolumeOutline
-> outline.generateChapterPlans
-> waiting_for_user
```

依赖规则：

- 可以引用 `core`、`runtime`、`capabilities`。
- 不拼接 prompt。
- 不直接调用 LLM。
- 不直接读写数据库，只通过 Workflow 注入的持久化接口记录节点状态。

当前建议：

- 现有 `graphs/*/index.ts` 仍是蓝图，保留。
- 后续每个图增加 `definition.ts`、`state.ts`、`nodes.ts`，避免一个文件承载全部逻辑。

### 4.5 `src/runtime`

`runtime` 是 Agent 层的运行时基础设施。

职责：

- `AgentHarness`：统一执行 capability，处理日志、错误、输入输出摘要和事件流。
- `ContextAssembler`：根据 `novelId`、任务类型、作用域和 token 预算装配上下文。
- `PromptCompiler`：把结构化上下文和专项模块规则编译成 LLM messages。
- `OutputParser`：解析模型输出并用 schema 校验。
- `ToolRuntime`：管理 MCP 或内部工具调用。
- `Guardrails`：校验 `novelId` 隔离、素材授权、canon 写入规则和输出边界。
- `RunRecorder`：记录 AgentRun、模型使用、工具使用、错误和关键中间结果。

建议结构：

```txt
src/runtime/
  harness/
    AgentHarness.ts
    invocationTypes.ts
  context/
    ContextAssembler.ts
    contextTypes.ts
    tokenBudget.ts
  prompt/
    PromptCompiler.ts
  output/
    OutputParser.ts
  tools/
    ToolRuntime.ts
    toolTypes.ts
  guardrails/
    guardrails.ts
  recorder/
    RunRecorder.ts
```

依赖规则：

- 可以依赖 `core`、`webnovelSkill`、`packages/llm` 抽象类型、`packages/memory` 接口。
- 不依赖 `apps/*`。
- 不固化具体数据库实现。

当前建议：

- `outlineFirstGeneration.ts` 当前承担了 runtime、capability、prompt、parser、normalizer 多种职责。它可以继续作为 MVP 纵切，但不应继续扩成更多业务能力。

### 4.6 `src/schemas`

`schemas` 是结构化输入输出契约层。

职责：

- 定义 capability 输入输出 schema。
- 定义 LLM JSON 输出 schema。
- 定义草案、补丁、评审报告、canon 提取结果、上下文包的结构。

建议结构：

```txt
src/schemas/
  outline.ts
  prose.ts
  review.ts
  memory.ts
  context.ts
  common.ts
```

依赖规则：

- 可以被 `capabilities`、`runtime`、`graphs`、测试引用。
- 不调用 LLM、数据库或工具。

关键要求：

- 所有 LLM 输出必须先通过 schema 校验。
- 校验失败时进入可重试错误，不把半结构化结果写入正式资产。

### 4.7 `src/webnovelSkill`

`webnovelSkill` 是中文网文专项能力层。

职责：

- 提供专项模块定义，例如前置规划、开头、分卷章纲、剧情逻辑、人物一致性、转场、对白、章末、去 AI 味、一致性审查。
- 根据任务类型和文本信号选择主模块、辅助模块和执行链。
- 输出模块规则、检查项和素材检索提示。

标准正文链：

```txt
plot_logic
-> character_consistency
-> transition
-> dialogue
-> chapter_ending
-> anti_ai_voice
-> consistency_review
```

局部修改链根据用户意图动态收缩：

```txt
人设问题 -> character_consistency -> dialogue -> consistency_review
逻辑问题 -> plot_logic -> transition -> consistency_review
AI 味问题 -> anti_ai_voice -> review.reviewStyle
章末问题 -> chapter_ending -> consistency_review
```

依赖规则：

- 不依赖 LLM。
- 不依赖 DB。
- 不依赖前端。
- 只返回路由决策、模块定义和 prompt 上下文片段。

当前建议：

- 保留现有 `router.ts`、`chains.ts`、`moduleDefinitions.ts`。
- 后续让 `review` 输出带 `moduleId` 的问题，方便修改链精准回到对应模块。

### 4.8 `resources/webnovel-skill`

`resources` 是内置素材和索引层。

职责：

- 保存系统内置中文网文模块素材包。
- 保存模块索引、素材来源索引和授权状态。
- 为 ContextAssembler 和素材检索提供只读数据来源。

依赖规则：

- 资源文件只读。
- 未确认授权的长文本语料不得复制为内置语料。
- 外部语料默认只保存来源索引、摘要、标签和授权状态。

当前建议：

- 保留现有素材包。
- 后续增加 `license`、`sourceType`、`allowedUsage`、`importedAt` 等元数据字段。

## 5. MCP 与工具边界

MCP 不应该成为 Agent 层的主流程，也不应该替代 Workflow 或数据库 repository。

推荐定位：

```txt
ToolRuntime / MCP = 受控工具执行层
ContextAssembler = 决定是否需要工具和素材
Workflow = 决定任务状态和写库
Repository = 权威数据读写
```

推荐工具类型：

```txt
readNovelAsset(novelId, assetKind, versionId?)
searchNovelMemory(novelId, query, scope)
searchChapterPlans(novelId, range)
getCharacterStates(novelId, chapterId?)
getForeshadowingLedger(novelId)
searchApprovedCorpus(moduleId, query)
proposeAssetPatch(novelId, assetKind, baseVersionId, patch)
```

硬约束：

- 所有小说私有工具必须携带 `novelId`。
- 工具层必须校验调用者任务的 `novelId`。
- LLM 不直接调用“覆盖正式资产”的工具。
- 工具输出进入 `ContextBundle` 或草案补丁，不绕过 schema 和人工确认。

## 6. 上下文装配策略

`ContextAssembler` 是 Agent 层最关键的稳定点之一。

输入：

```ts
{
  novelId: string;
  taskKind: "outline" | "chapter_draft" | "chapter_review" | "local_revision";
  scope: "novel" | "volume" | "chapter" | "scene";
  baseVersionId?: string;
  volumeId?: string;
  chapterId?: string;
  userInstruction?: string;
  tokenBudget: number;
}
```

输出：

```ts
{
  authoritativeAssets: unknown;
  canonFacts: string[];
  workingSummaries: string[];
  nearbyChapterPlans: unknown[];
  characterStates: unknown[];
  foreshadowingItems: unknown[];
  styleConstraints: string[];
  webnovelModules: unknown[];
  materialSnippets: unknown[];
  previousDecisions: string[];
  compressionReport: string;
}
```

装配优先级：

1. 必读结构化资产：当前章纲、当前卷目标、角色当前状态、世界观硬规则、伏笔账本。
2. 近邻上下文：最近 3 到 5 章摘要、前后章纲、上一章结尾、下一章目标。
3. 长程检索：早期伏笔、历史关系、旧设定、跨卷因果。
4. 专项模块规则：由 `webnovelSkill` 路由后选择。
5. 授权素材：只给结构、节奏、诊断维度和短摘录，不复用原文句面。

## 7. 资产版本与人工确认

Agent 层输出分三类：

```txt
Draft：可展示草案，例如首次大纲、章节正文草稿。
Patch：针对已有资产的结构化修改补丁。
Report：评审报告、风险列表、下一步建议。
```

需要人工确认的 capability 不得直接覆盖正式资产。

推荐状态：

```txt
generated
reviewed
waiting_for_user
accepted
rejected
superseded
```

用户反复修改时，应基于 `baseVersionId` 新建 `ChangeRequest` 或 `AssetRevision`，而不是把聊天历史当作权威上下文。

## 8. Harness 工程要求

Agent Harness 需要支持以下能力：

1. 统一 capability 调用入口。
2. 统一 LLM 调用审计。
3. 统一错误分类：配置错误、供应商错误、schema 错误、工具错误、guardrail 错误。
4. 统一事件流：开始、上下文装配完成、模型调用开始、模型调用完成、解析完成、评审完成、等待用户确认、失败。
5. 支持测试替身：FakeModel、FakeContextAssembler、FakeToolRuntime。
6. 支持离线 golden fixture：同一输入和上下文下比较结构化输出形态。

推荐接口形态：

```ts
AgentHarness.invoke({
  novelId,
  taskId,
  capabilityId,
  input,
  contextPolicy,
  modelPolicy,
  toolPolicy,
});
```

## 9. 当前结构评估与调整建议

当前结构总体方向正确：

- `core` 已经有 Agent 和 capability 类型。
- `agents` 已经按七类顶层 Agent 分好。
- `graphs` 已经有工作流蓝图和最小 `outlinePlanning` LangGraph。
- `webnovelSkill` 已经有模块路由和链路定义。
- `runtime/outlineFirstGeneration.ts` 已经转为兼容 facade。
- `capabilities`、`schemas`、`runtime/harness` 已经落地。

主要问题：

1. 目前只有 `outlinePlanning` 落地为真实 LangGraph，其它图仍是蓝图。
2. AgentRun 持久化尚未接入数据库，当前通过 `RunRecorder` 接口抽象。
3. ToolRuntime / MCP 只保留接口，尚未接真实工具。
4. 外部素材授权检索尚未接入 ContextAssembler。

建议演进顺序：

```txt
第一步：为 proseProduction / chapterReview / memoryUpdate 补真实 LangGraph。
第二步：将 AgentRun 通过 RunRecorder 接入数据库持久化。
第三步：让 ContextAssembler 接入小说资产 repository、FTS/向量检索和素材授权过滤。
第四步：将 ToolRuntime 接入 MCP 或内部工具注册表。
第五步：补充 fake model 单元测试和 graph 级集成测试。
```

## 10. 文档分布建议

当前阶段建议保留两类文档：

- `docs/architecture/agent-layer-technical-design.md`：架构级方案和边界，供产品、架构和后续开发者阅读。
- `packages/agents/README.md`：包内快速索引，供写代码时就近查看。

后续当对应目录实现变复杂时，再增加：

```txt
packages/agents/src/runtime/README.md
packages/agents/src/webnovelSkill/README.md
packages/agents/src/graphs/README.md
packages/agents/src/capabilities/README.md
```

不要在每个小目录都提前放空泛文档。文档应该跟随稳定边界增长，而不是抢在代码事实之前膨胀。
