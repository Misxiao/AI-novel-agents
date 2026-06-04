---
id: agent-system
title: 多 Agent 系统 PRD
version: 1.0
state: draft
owner: product
created_at: 2026-05-27
updated_at: 2026-05-27
---

# 多 Agent 系统 PRD

## 1. 背景

本项目需要一个内置多 Agent 系统来支撑中文网文长期创作。Agent 不应该是前端可配置项，也不应该被设计成单一功能按钮。每个 Agent 应代表一个稳定职责域，并在职责域下提供多个可调用子能力。

## 2. 目标

- 建立基础 Agent 文件架构。
- 明确 Agent 与子能力的边界。
- 将“生成 Agent”和“修改 Agent”收敛为正文 Agent 的子能力。
- 支持大纲 Agent 对整书、单卷、章纲的生成与修改。
- 为后续 LangGraph 工作流实现提供稳定开发入口。

## 3. 非目标

- 不实现完整 LangGraph 运行逻辑。
- 不实现前端 Agent 配置页面。
- 不把 Prompt/Skill 作为用户可编辑资源。
- 不在本 PRD 中定义数据库 schema。

## 4. Agent 需求

### 4.1 灵感 Agent

必须支持灵感发散、点子评估、书名简介候选。

### 4.2 总编/调度 Agent

必须支持创建小说基础盘、规划下一步动作、协调多 Agent 工作流。

### 4.3 大纲 Agent

必须支持：

- 生成整书大纲。
- 修改整书大纲。
- 生成分卷大纲。
- 修改分卷大纲。
- 生成章纲。
- 修改单章章纲。

### 4.4 正文 Agent

正文 Agent 统一承接生成与修改能力。必须支持：

- 生成章节正文。
- 修改章节正文。
- 重写场景。
- 扩写正文。
- 压缩正文。
- 风格处理。

不得再新增顶层“生成 Agent”或“修改 Agent”。

### 4.5 评审 Agent

必须支持章节评审、大纲评审、一致性评审和风格评审。评审 Agent 不直接修改正文或大纲。

### 4.6 记忆 Agent

必须支持上下文检索、canon 提取和小说记忆更新。未确认草稿不得写入 canon。

### 4.7 数据分析 Agent

预留阅读数据导入、阅读数据分析和内容调整建议。

## 5. 验收标准

- `packages/agents/src/core` 存在 Agent 类型和注册表。
- `packages/agents/src/agents` 存在七类 Agent 定义。
- `packages/agents/src/graphs` 存在基础工作流蓝图。
- `docs/ai/agent-architecture.md` 描述 Agent 架构和后续实现规则。
- `prose` 是正文生成和修改的唯一顶层 Agent。
- `outline` 同时覆盖整书、单卷、章纲的生成和修改能力。

## 6. 决策日志

| 日期 | 决策 | 理由 |
| --- | --- | --- |
| 2026-05-27 | 生成与修改能力归入正文 Agent | 避免顶层 Agent 过碎，正文生产应统一管理 |
| 2026-05-27 | 大纲 Agent 采用多子能力设计 | 大纲工作包含整书、分卷、章纲和局部修改 |
| 2026-05-27 | Agent 作为内置能力，不做前端配置 | 符合项目产品边界 |

