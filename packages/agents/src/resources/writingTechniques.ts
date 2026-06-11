export interface ChapterTechniqueSource {
  id: string;
  title: string;
  platform: string;
  url: string;
  note: string;
}

export interface ChapterTechniqueCategory {
  id: string;
  title: string;
  sourceIds: string[];
  rules: string[];
}

export interface ChapterWritingTechniqueResource {
  version: string;
  updatedAt: string;
  scope: "chapter.writeNextChapter";
  sources: ChapterTechniqueSource[];
  categories: ChapterTechniqueCategory[];
  promptRules: string[];
  selfCheckQuestions: string[];
}

export const chapterWritingTechniqueResource: ChapterWritingTechniqueResource = {
  version: "2026-06-04",
  updatedAt: "2026-06-04",
  scope: "chapter.writeNextChapter",
  sources: [
    {
      id: "source-pacing-reward-density",
      title: "网文节奏与爽点设计",
      platform: "写作博客",
      url: "https://maliangwriter.com/blog/novel-pacing-hook-design-guide/",
      note: "提炼节奏、爽点密度、章末钩子和 AI 节奏均匀问题。",
    },
    {
      id: "source-tieba-paragraphing",
      title: "网络小说分段技巧详谈",
      platform: "百度贴吧",
      url: "https://tieba.baidu.com/p/3258183769",
      note: "提炼移动阅读分段、镜头感、留白和蓄势方法。",
    },
    {
      id: "source-douyin-opening-six",
      title: "网文写作技巧：开篇黄金六要素",
      platform: "抖音精选",
      url: "https://jingxuan.douyin.com/m/video/7541541797818830130",
      note: "提炼强钩子、主角辨识度、世界观冰山法、主线暗示、高效叙事和风味标签。",
    },
    {
      id: "source-douyin-staircase",
      title: "阶梯式主线写法与爽点优化",
      platform: "抖音",
      url: "https://www.douyin.com/shipin/7318841931189078031",
      note: "提炼阶段目标、成长蓄力、冲突爆发、伏笔回收、未知惊喜、仪式感和社交认证。",
    },
    {
      id: "source-tieba-qidian-summary",
      title: "龙空精华搬运：起点吧写作总结",
      platform: "百度贴吧",
      url: "https://tieba.baidu.com/p/10071180915",
      note: "提炼主角视角切入、直接进入剧情、大纲控节奏、章节字数、解密节奏和对白实践。",
    },
    {
      id: "source-webnovel-research",
      title: "数字时代的文学变奏：网络小说创作",
      platform: "学术论文",
      url: "https://wxy.yzu.edu.cn/__local/5/F9/02/27FCB2057D079135EA16E6B8E1A_39F674A4_1ECA1A.pdf",
      note: "提炼情节单元起承转合、波浪式升级、大纲控节奏和获得感结构。",
    },
    {
      id: "source-longform-pacing-research",
      title: "Improving Pacing in Long-Form Story Planning",
      platform: "arXiv",
      url: "https://arxiv.org/abs/2311.04459",
      note: "提炼长篇故事中事件详略失衡会造成节奏不自然，生成时要控制具体度。",
    },
  ],
  categories: [
    {
      id: "opening-hook",
      title: "开篇与入章钩子",
      sourceIds: ["source-douyin-opening-six", "source-tieba-qidian-summary"],
      rules: [
        "章节开头要尽快给出主角、处境和正在发生的具体事件，不要先铺大段世界观。",
        "优先用主角视角或强相关视角切入，让读者跟着角色接收信息。",
        "世界观只露出当前情节需要的一角，设定必须服务本章目标、冲突或代价。",
        "本章开场必须承接章纲目标，并在前几段给出读者想继续看的问题。",
      ],
    },
    {
      id: "chapter-micro-structure",
      title: "章节微结构",
      sourceIds: ["source-webnovel-research", "source-longform-pacing-research"],
      rules: [
        "每章至少完成目标、阻碍、变化三件事，结尾局面必须和开头不同。",
        "按小型起承转合推进：启动问题、加压推进、出现转折、留下新状态或新问题。",
        "控制事件具体度：关键选择、冲突、后果要具体写；过渡信息和背景说明要压缩。",
        "解决一个小问题时同步打开一个新压力，避免章节收得过干净。",
      ],
    },
    {
      id: "pacing-reward",
      title: "节奏与获得感",
      sourceIds: ["source-pacing-reward-density", "source-webnovel-research", "source-douyin-staircase"],
      rules: [
        "每章至少给读者一个小回报：发现、反击、关系变化、能力进展、信息差兑现或小反转。",
        "爽点不要只写结果，要写铺垫、爆发、旁观反应和局面改变。",
        "让情绪强度波浪式上升，避免全章一个速度、一个情绪、一个句式。",
        "高光时刻要有仪式感；主角的胜利最好被对手、旁观者或关键关系看见。",
      ],
    },
    {
      id: "chapter-ending",
      title: "章末钩子",
      sourceIds: ["source-pacing-reward-density"],
      rules: [
        "章末不要停在总结句，要停在问题、威胁、揭示、反转、情绪爆点或新行动之前。",
        "章末钩子必须来自本章变化，不要硬塞无关悬念。",
        "如果本章完成了一个承诺，结尾要立刻打开下一个更具体的承诺。",
        "钩子要能在后续一到两章内兑现或推进，避免透支读者信任。",
      ],
    },
    {
      id: "character-dialogue",
      title: "人物与对白",
      sourceIds: ["source-tieba-qidian-summary", "source-douyin-opening-six"],
      rules: [
        "主角可以普通、有缺点，但必须有积极行动或可共鸣的目标，避免只被动挨打。",
        "对白必须改变信息、关系或局面之一，不让角色替作者讲设定。",
        "不同角色的句长、词汇、回避方式和情绪出口要有区别。",
        "人物反应要接住上一场的情绪、身体状态和信息状态。",
      ],
    },
    {
      id: "paragraph-lens",
      title: "移动阅读分段与镜头感",
      sourceIds: ["source-tieba-paragraphing"],
      rules: [
        "段落要服务移动端阅读，避免连续大段压迫读者视线。",
        "长短段落错落使用；短句和独立段可用于蓄势、停顿、转折和慢镜头。",
        "场景转换要带状态、空间、动作或物件，不要突然跳切让镜头断裂。",
        "重要动作、发现和情绪落点可以用留白强化，但不要全章都碎成同一种节奏。",
      ],
    },
    {
      id: "ai-draft-guardrails",
      title: "AI 草稿去模板化",
      sourceIds: ["source-pacing-reward-density", "source-douyin-staircase"],
      rules: [
        "不要把 AI 当自由续写器；必须沿着章纲目标、人物状态和本章钩子生成。",
        "避免均匀、工整、空泛的 AI 腔：减少抽象感叹，增加具体动作、选择、代价和反应。",
        "情绪不要只说出来，要落到身体、动作、沉默、误解、退让或反击上。",
        "写完后自查是否有重复解释、万能形容词、同质化对白和无后果事件。",
      ],
    },
  ],
  promptRules: [
    "开头尽快落到主角、处境和正在发生的具体事件，不先铺大段世界观。",
    "每章必须完成目标、阻碍、变化；结尾局面必须和开头不同。",
    "每章至少给一个小回报：发现、反击、关系变化、能力进展、信息差兑现或小反转。",
    "关键事件具体写，过渡信息压缩写，避免详略失衡造成节奏拖沓。",
    "爽点要有铺垫、爆发、旁观反应和局面改变，不只写结果。",
    "对白必须改变信息、关系或局面之一，不让角色替作者讲设定。",
    "段落服务移动端阅读，长短错落；短句和独立段可用于蓄势、停顿、转折和慢镜头。",
    "章末停在问题、威胁、揭示、反转、情绪爆点或新行动之前，不停在总结句。",
    "避免均匀、工整、空泛的 AI 腔，用具体动作、选择、代价和反应承载情绪。",
  ],
  selfCheckQuestions: [
    "本章开头是否在前几段给出主角、处境、事件和问题？",
    "本章目标、阻碍、变化是否都已落到正文行动中？",
    "读者在本章得到的最小回报是什么？",
    "本章是否有一个具体的高压选择、代价或关系变化？",
    "章末钩子属于问题、威胁、揭示、反转、情绪爆点还是新行动？",
    "是否存在大段设定说明、无目的对白、无后果事件或模板化情绪总结？",
  ],
};

export function buildChapterTechniquePromptLines() {
  return [
    ...chapterWritingTechniqueResource.promptRules.map((rule) => `- ${rule}`),
    "自检清单：",
    ...chapterWritingTechniqueResource.selfCheckQuestions.map((question) => `- ${question}`),
  ];
}
