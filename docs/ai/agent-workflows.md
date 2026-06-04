# 内置 Agent 工作流说明

## 设计原则

平台不暴露 Agent 配置、Prompt 管理或 Skill 管理页面。所有 Agent 能力作为项目内置生产能力存在，由代码、测试和文档维护。

中文网文写作专项逻辑位于 `packages/agents/src/webnovelSkill/`。该逻辑参考 `Chinese-WebNovel-Skill` 的模块化方法，并转换为本项目的内置路由、模块定义和素材包。

## 内置 Agent

- 灵感 Agent：生成选题、卖点、书名、简介和方向。
- 立项 Agent：判断题材、冲突、故事引擎和目标体量。
- 大纲 Agent：生成总纲、卷纲、章纲和伏笔账本。
- 设定 Agent：维护世界观、角色和设定一致性。
- 生成 Agent：根据章纲和记忆生成正文。
- 评审 Agent：检查逻辑、节奏、角色、章末和 AI 味。
- 修改 Agent：执行局部重写、扩写、压缩和润色。
- 记忆更新 Agent：更新 canon、摘要、人物状态和伏笔状态。
- 数据分析 Agent：后续分析阅读数据和评论反馈。
- 总编/调度 Agent：选择下一步工作流和人工确认点。

顶层 Agent 只保留稳定职责域。生成 Agent 和修改 Agent 不作为顶层 Agent 存在，统一收敛为正文 Agent 的子能力。大纲 Agent 也不是单一功能，它同时承担整书大纲、分卷大纲、章纲的生成与修改。

## MVP 工作流

- `novel-intake-graph`
- `outline-planning-graph`
- `chapter-production-graph`
- `chapter-review-graph`
- `chapter-revision-graph`
- `memory-update-graph`

当前已落地的最小 LangGraph 是 `outline-planning-graph`，执行链为：

```txt
director.planNextAction
-> memory.retrieveContext
-> outline.generateBookOutline
-> review.reviewOutline
-> outline.generateVolumeOutline
-> outline.generateChapterPlans
```

其中 `outline.generateBookOutline` 是强节点，失败会导致任务失败；其余辅助节点先按软节点处理，真实调用 LLM，但失败只写入大纲问题列表，不阻断首次大纲生成。

## 中文网文专项链路

规划链：

`concept_planning -> opening -> volume_outline`

章节生产链：

`plot_logic -> character_consistency -> transition -> dialogue -> chapter_ending -> anti_ai_voice -> consistency_review`

局部修改链：

`plot_logic / character_consistency / transition / dialogue / chapter_ending / anti_ai_voice`

完稿收口链：

`consistency_review`
