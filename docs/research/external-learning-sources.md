# 外部学习源索引

## 目的

本目录记录项目 Agent 后续开发时需要优先参考的外部开源项目、Skill、论文或资料库。外部学习源用于启发架构、流程、模块拆分、Prompt 组织、检索策略和质量评审方法，不等同于本项目内置能力。

外部源码镜像默认放在：

```txt
external/learning-sources/
```

该目录已被 `.gitignore` 忽略，只用于本地查阅。真正内化到项目中的设计、规则、模块和素材，必须通过中文调研文档、项目代码和资源清单显式落地。

## 默认查阅规则

当开发内容涉及 Agent、Workflow、中文网文生成、章节正文、章纲、大纲、评审、记忆、检索或写作素材包时，默认先查看本索引，再按任务类型阅读对应外部学习源和调研记录。

查阅顺序：

1. 先读本文件，确认有哪些外部学习源与当前任务相关。
2. 再读对应的 `docs/research/*-study.md`，优先理解已经提炼过的项目内化结论。
3. 如需要细节，再查看 `external/learning-sources/<source>/` 中的源码、文档、脚本或资源结构。
4. 实现时优先吸收架构、流程、接口设计、方法论、Prompt 组织方式、审查维度、写作技法和文本结构模式；所有内化内容必须经过方法论提炼、结构转译、原创化重写和项目化表达。
5. 不直接复制或近似复刻未确认授权的长文本语料、示例正文、大段 Prompt 或受许可证限制的源码。
6. 若要导入或内化外部内容到 `packages/agents/resources/`，必须记录来源、授权状态、hash 或观察提交、作用域、提炼方式和导入原因。

## 当前学习源

| 标识 | 本地位置 | 来源 | 主要用途 | 内化状态 |
| --- | --- | --- | --- | --- |
| `novelix` | `external/learning-sources/novelix/`，符号链接到 `/Users/yaokangjing/Documents/projects/novelix` | `https://github.com/zxerai/novelix` | 学习长篇小说 Agent、工作流、记忆、真相文件、审计和生成链路设计。 | 初步调研 |
| `chinese-webnovel-skill` | `external/learning-sources/Chinese-WebNovel-Skill/` | `https://github.com/Tomsawyerhu/Chinese-WebNovel-Skill` | 学习中文网文专项模块、路由、素材检索和完稿审查闭环。 | 已部分内化 |

## 已有调研记录

- `docs/research/chinese-webnovel-skill-study.md`
- `docs/research/novelix-study.md`

## 待补调研记录

- 后续新增学习源时，补充对应的 `docs/research/<source>-study.md`

## 内化落点

外部学习源经过筛选后，只能进入以下项目边界：

- Agent 能力与路由：`packages/agents/src/`
- 中文网文专项模块：`packages/agents/src/webnovelSkill/`
- 已确认可内置素材：`packages/agents/resources/webnovel-skill/`
- Workflow 编排：`packages/workflow/src/`
- 架构、调研和设计说明：`docs/`

不要把外部学习源做成前端配置入口，也不要把外部仓库全文直接提交到项目源码中。优秀 Prompt、Skill 规则和文本样式只能作为学习材料，必须转化为本项目原创的规则、检查项、示例短句或结构化素材。
