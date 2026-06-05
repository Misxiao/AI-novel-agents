import type { ChatMessage } from "../../../core/types.js";
import { buildChapterModulePromptLines } from "../../../webnovelSkill/runtime.js";
import type {
  ChapterContextPackage,
  CompressTextInput,
  ExpandTextInput,
  PlanChapterDraftInput,
  PolishStyleInput,
  RewriteSceneInput,
  ReviseChapterInput,
  WriteNextChapterInput,
} from "../types.js";
import { buildChapterTechniquePromptLines } from "../resources/chapterWritingTechniques.js";

const chapterDraftGuidance = [
  "每章必须有清晰的目标、阻碍和局面变化。",
  "优先推进剧情和人物行动，避免空泛抒情、总结式说教和说明书对白。",
  "对白要承担关系压力、信息嵌入和局面推进。",
  "章末必须留下明确追读理由，并承接章纲中的章末拉力。",
  "不要写入未在输入中出现的跨小说设定，不要引用其它小说项目的内容。",
  "只产出待确认草稿，不写入 canon，不声明已更新记忆。",
];

const chapterTechniquePromptLines = buildChapterTechniquePromptLines();
const chapterModulePromptLines = buildChapterModulePromptLines();

export function buildPlanChapterDraftMessages(input: PlanChapterDraftInput): ChatMessage[] {
  const targetWords = input.targetWords ?? 2500;

  return buildChapterMessages({
    systemTask: "你的职责是为当前章节生成写作前执行计划。",
    userLines: [
      "请生成本章写作执行计划。",
      "",
      ...renderNovelAndPlan(input),
      ...renderContext(input.context),
      "",
      "## 计划要求",
      `目标正文长度：约 ${targetWords} 个中文字符。`,
      "必须明确：视角、目标、阻碍、局面变化、场景节拍、预期爽点、章末钩子和设定风险。",
      "不要生成正文。",
      "",
      "## 输出 JSON",
      "格式必须为：{\"viewpoint\":\"视角\",\"objective\":\"本章目标\",\"obstacle\":\"核心阻碍\",\"change\":\"章末局面变化\",\"sceneBeats\":[{\"sceneNo\":1,\"purpose\":\"场景目的\",\"conflict\":\"冲突\",\"change\":\"变化\",\"keyCharacters\":[\"角色\"]}],\"rewardMoment\":\"预期爽点\",\"endingHook\":\"章末钩子\",\"riskNotes\":[\"风险\"],\"warnings\":[\"警告\"]}。",
    ],
  });
}

export function buildWriteNextChapterMessages(input: WriteNextChapterInput): ChatMessage[] {
  const targetWords = input.targetWords ?? 2500;

  return buildChapterMessages({
    systemTask: "你的职责是根据当前小说的章纲和上下文包生成下一章正文草稿。",
    userLines: [
      "请生成下一章正文草稿。",
      "",
      ...renderNovelAndPlan(input),
      ...renderContext(input.context),
      ...renderDraftPlan(input.draftPlan),
      "",
      "## 写作约束",
      `目标字数：约 ${targetWords} 个中文字符，可上下浮动，但不要明显短章。`,
      ...chapterDraftGuidance.map((item) => `- ${item}`),
      ...(input.context?.styleGuidance ?? []).map((item) => `- ${item}`),
      ...(input.context?.forbiddenExpressions ?? []).map((item) => `- 禁用表达：${item}`),
      "",
      "## 网文写作技法资源",
      ...chapterTechniquePromptLines,
      "",
      "## 输出要求",
      "返回一个合法 JSON 对象。",
      "JSON 格式必须为：{\"title\":\"章节标题\",\"content\":\"章节正文\",\"summary\":\"本章摘要\",\"warnings\":[\"风险提示\"]}。",
      "content 必须是可直接放入正文编辑器的中文小说正文，不要包含章节标题行。",
      "warnings 如果没有明显风险，返回空数组。",
    ],
  });
}

export function buildReviseChapterMessages(input: ReviseChapterInput): ChatMessage[] {
  return buildTextOperationMessages({
    input,
    taskTitle: "请根据修改要求和评审问题修订整章正文。",
    extraLines: [
      "只修订与要求或评审问题相关的内容，保持无关剧情事实、人物状态和专有名词稳定。",
      "如果某个评审问题无法安全处理，请写入 unresolvedRisks。",
    ],
  });
}

export function buildRewriteSceneMessages(input: RewriteSceneInput): ChatMessage[] {
  return buildTextOperationMessages({
    input,
    taskTitle: "请重写指定场景，并返回替换后的完整章节正文。",
    extraLines: [
      `指定场景：${input.scene.label ?? input.scene.id ?? "未命名场景"}`,
      "原场景片段：",
      input.scene.originalText,
      "只替换该场景相关内容，保持整章其他部分稳定。",
    ],
  });
}

export function buildExpandTextMessages(input: ExpandTextInput): ChatMessage[] {
  return buildTextOperationMessages({
    input,
    taskTitle: "请扩写章节正文。",
    extraLines: [
      `目标字数：约 ${input.targetWords} 个中文字符。`,
      "扩写重点放在动作、选择、代价、关系压力、感官细节和局面变化，不新增无来源的重大设定。",
    ],
  });
}

export function buildCompressTextMessages(input: CompressTextInput): ChatMessage[] {
  return buildTextOperationMessages({
    input,
    taskTitle: "请压缩章节正文。",
    extraLines: [
      `目标字数：约 ${input.targetWords} 个中文字符。`,
      "压缩说明、重复情绪和过渡段，保留因果、关键对白、人物选择、伏笔和章末钩子。",
    ],
  });
}

export function buildPolishStyleMessages(input: PolishStyleInput): ChatMessage[] {
  return buildTextOperationMessages({
    input,
    taskTitle: "请进行风格处理和去 AI 味润色。",
    extraLines: [
      `风格目标：${input.styleGoal?.trim() || "减少模板化表达，增强具体动作、人物声音和移动阅读节奏。"}`,
      "不得改变剧情因果、人物状态、设定事实和章末承诺。",
    ],
  });
}

function buildChapterMessages(params: { systemTask: string; userLines: string[] }): ChatMessage[] {
  return [
    {
      role: "system",
      content: [
        "你是本地中文网文创作平台内置的 chapter Agent。",
        params.systemTask,
        "Agent、Prompt、Skill 和 Workflow 是项目内置能力，不向前端暴露配置。",
        "只输出 JSON 对象，不输出 Markdown，不输出解释。",
      ].join("\n"),
    },
    {
      role: "user",
      content: [
        ...params.userLines,
        "",
        "## 内置中文网文模块链",
        ...chapterModulePromptLines,
        "章节草稿完成后必须标记需要进入 consistency_review，但不要冒充评审 Agent 给最终验收结论。",
      ].join("\n"),
    },
  ];
}

function buildTextOperationMessages(params: {
  input: ReviseChapterInput;
  taskTitle: string;
  extraLines: string[];
}): ChatMessage[] {
  return buildChapterMessages({
    systemTask: "你的职责是修订、重写、扩写、压缩或润色章节正文草稿。",
    userLines: [
      params.taskTitle,
      "",
      ...renderNovelAndPlan(params.input),
      ...renderContext(params.input.context),
      "",
      "## 当前草稿",
      `draftId：${params.input.draft.draftId}`,
      `标题：${params.input.draft.title}`,
      `摘要：${params.input.draft.summary?.trim() || "暂缺"}`,
      "正文：",
      params.input.draft.content,
      "",
      "## 修改输入",
      `用户要求：${params.input.instruction?.trim() || "无额外用户要求，按任务标题处理。"}`,
      ...renderReviewIssues(params.input.reviewIssues),
      ...params.extraLines,
      "",
      "## 输出要求",
      "返回一个合法 JSON 对象。",
      "JSON 格式必须为：{\"title\":\"章节标题\",\"content\":\"修订后的完整章节正文\",\"summary\":\"新版摘要\",\"changedSummary\":\"修改摘要\",\"handledIssueIds\":[\"已处理问题 id\"],\"unresolvedRisks\":[\"未处理风险\"],\"warnings\":[\"风险提示\"]}。",
      "content 必须是完整章节正文，不要只返回局部片段，不要包含章节标题行。",
    ],
  });
}

function renderNovelAndPlan(input: Pick<WriteNextChapterInput, "novel" | "chapterPlan">) {
  return [
    "## 小说基础",
    `novelId：${input.novel.novelId}`,
    `书名：${input.novel.title}`,
    `题材：${input.novel.genre}`,
    `核心钩子：${input.novel.hook}`,
    `目标读者：${input.novel.targetReaders}`,
    `当前分卷：${input.novel.currentVolume}`,
    `计划总章数：${input.novel.totalChapters}`,
    "",
    "## 当前章纲",
    `章节：第 ${input.chapterPlan.chapterNo} 章`,
    `标题：${input.chapterPlan.title}`,
    `所属分卷：${input.chapterPlan.volumeTitle}`,
    `章节目标：${input.chapterPlan.objective}`,
    `章末拉力：${input.chapterPlan.hook}`,
  ];
}

function renderContext(context?: ChapterContextPackage) {
  return [
    "",
    "## 上下文包",
    `总纲摘要：${context?.outlineSummary?.trim() || "暂缺，严格按当前章纲和小说基础生成。"}`,
    `分卷目标：${context?.volumeGoal?.trim() || "暂缺，严格按当前章纲推进。"}`,
    `上一章摘要：${context?.previousChapterSummary?.trim() || "暂缺，把本章写成可自然开启的章节。"}`,
    `下一章目标：${context?.nextChapterObjective?.trim() || "暂缺，章末只承接当前章纲钩子。"}`,
    ...renderList("近邻章纲", context?.nearbyChapterPlans?.map((item) => `第 ${item.chapterNo} 章《${item.title}》：${item.objective}${item.hook ? `；钩子：${item.hook}` : ""}`)),
    ...renderList("角色当前状态", context?.characterStates?.map((item) => `${item.name}：目标=${item.currentGoal || "未提供"}；情绪=${item.emotion || "未提供"}；关系=${item.relationship || "未提供"}；身体=${item.physicalState || "未提供"}；口吻=${item.voice || "未提供"}`)),
    ...renderList("世界观硬规则", context?.worldRules),
    ...renderList("伏笔状态", context?.foreshadowing?.map((item) => `${item.title}（${item.status}）：${item.summary}${item.payoffHint ? `；兑现提示：${item.payoffHint}` : ""}`)),
    ...renderList("Canon 事实", context?.canonFacts),
    ...renderList("检索片段", context?.ragSnippets),
  ];
}

function renderDraftPlan(draftPlan?: WriteNextChapterInput["draftPlan"]) {
  if (!draftPlan) {
    return [
      "",
      "## 写作执行计划",
      "暂缺，请直接按当前章纲和上下文生成，但必须保持目标、阻碍、变化和章末拉力清晰。",
    ];
  }

  return [
    "",
    "## 写作执行计划",
    `视角：${draftPlan.viewpoint}`,
    `目标：${draftPlan.objective}`,
    `阻碍：${draftPlan.obstacle}`,
    `章末变化：${draftPlan.change}`,
    `预期爽点：${draftPlan.rewardMoment}`,
    `章末钩子：${draftPlan.endingHook}`,
    ...renderList("场景节拍", draftPlan.sceneBeats.map((beat) => `场景 ${beat.sceneNo}：${beat.purpose}；冲突：${beat.conflict}；变化：${beat.change}`)),
    ...renderList("风险规避", draftPlan.riskNotes),
  ];
}

function renderReviewIssues(issues?: ReviseChapterInput["reviewIssues"]) {
  return renderList(
    "评审问题",
    issues?.map((issue) => `${issue.id} / ${issue.severity ?? "warning"} / ${issue.category}：${issue.description}${issue.suggestion ? `；建议：${issue.suggestion}` : ""}`),
  );
}

function renderList(title: string, items?: string[]) {
  const normalized = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return [`${title}：暂缺`];
  }

  return [`${title}：`, ...normalized.map((item) => `- ${item}`)];
}
