# Chinese-WebNovel-Skill 调研与项目内化记录

## 来源

- 仓库：`https://github.com/Tomsawyerhu/Chinese-WebNovel-Skill`
- 观察提交：`4e0332eec0da62bf160eb284944a4c0def40b4c9`
- 观察日期：2026-05-26

## 结构观察

该 skill 的核心不是单个 Prompt，而是一套中文网文专项模块系统。它把任务拆成前置规划、开头、分卷章纲、剧情逻辑、人物一致性、转场、对白、章末、去 AI 味和完稿审查十个模块。

项目中同时包含：

- `SKILL.md`：总入口与模块路由。
- `references/modules`：十个专项模块。
- `analysis`：语料分析与仿写索引。
- `data/articles`：小说正文语料。
- `中长篇demo` 和 `各类主题短篇demo`：示例文档。

## 可内化逻辑

本项目已内化以下能力：

- 阶段判断：先判断任务属于规划、开头、章纲、正文执行、局部修复还是完稿审查。
- 模块路由：根据任务类型和关键词选择主模块与辅助模块。
- 正文执行链：剧情逻辑、人物一致性、转场、对白、章末、去 AI 味按优先级协作。
- 完稿审查：每章写完默认进入六项一致性检查。
- 素材策略：先匹配素材或结构，再写计划，再生成或修改。

## 未直接内置的内容

未直接复制小说正文、PDF 和 docx 示例。原因是外部仓库未发现明确 LICENSE 文件，且包含大量可能受版权保护的长文本内容。

后续如果确认拥有使用权，可以实现导入器，把用户授权素材导入本地私有素材库，并建立检索索引。

## 已落地文件

- `packages/agents/src/webnovelSkill/types.ts`
- `packages/agents/src/webnovelSkill/moduleDefinitions.ts`
- `packages/agents/src/webnovelSkill/router.ts`
- `packages/agents/src/webnovelSkill/chains.ts`
- `packages/agents/resources/webnovel-skill/`

