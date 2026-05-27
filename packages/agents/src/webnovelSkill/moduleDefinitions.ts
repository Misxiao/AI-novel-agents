import type { WebnovelModuleDefinition, WebnovelModuleId } from "./types.js";

export const WEBNOVEL_MODULES: WebnovelModuleDefinition[] = [
  {
    id: "concept_planning",
    name: "前置规划模块",
    stage: "planning",
    responsibility:
      "把一句或一段小说简介压成题材、消费点、卖点、hook、premise、故事引擎、目标长度和第一卷方向。",
    triggers: ["点子", "灵感", "题材", "卖点", "hook", "premise", "简介", "故事引擎", "值不值得写"],
    negativeSignals: ["只给大设定但没有眼前麻烦", "只有世界观没有消费点", "只有氛围没有推进机制"],
    layers: [
      {
        id: "genre_consumption",
        name: "题材 / 消费点层",
        diagnosis: ["题材是否能被读者快速识别", "消费点是否集中", "是否混入太多互相打架的类型承诺"],
        repairFocus: ["压缩题材标签", "明确读者为了什么继续看", "删除不服务卖点的大设定"],
      },
      {
        id: "hook_premise",
        name: "卖点 / 异常局面层",
        diagnosis: ["异常局面是否足够早出现", "hook 是否能一句话说清", "premise 是否包含冲突和方向"],
        repairFocus: ["补强反常识局面", "把卖点落到主角处境", "用第一麻烦启动故事"],
      },
      {
        id: "story_engine",
        name: "故事引擎层",
        diagnosis: ["前 10 到 20 章是否有持续推进机制", "主角每章是否有新目标和新阻碍"],
        repairFocus: ["定义可重复运转的任务结构", "确定阶段性兑现点", "规划第一卷最小闭环"],
      },
    ],
    beforeWritingPlan: ["题材与读者消费点", "一句话 hook", "premise", "主角眼前麻烦", "第一卷最小目标"],
    hardRules: ["先判断值不值得写，再写正文", "先给卖点和冲突，再展开设定", "简介压不出最小骨架时不要急着开写"],
    outputContracts: [
      {
        taskKind: "idea_diagnosis",
        sections: ["题材诊断", "核心消费点", "一句话 hook", "premise", "故事引擎", "长度判断", "第一卷方向"],
      },
      {
        taskKind: "hook_or_premise",
        sections: ["问题判断", "新版 hook", "新版 premise", "第一麻烦", "可持续推进机制"],
      },
    ],
    materialHints: [
      { query: "同题材高概念开局", useFor: "判断消费点和异常局面" },
      { query: "强 hook 短篇或网文简介", useFor: "借结构，不借句面" },
    ],
  },
  {
    id: "opening",
    name: "开头模块",
    stage: "opening",
    responsibility: "把卖点、异常局面和主角亮相落到开头成交区，优先解决开头慢热和卖点露头太晚。",
    triggers: ["开头", "开篇", "黄金三章", "第一章", "起得慢", "抓手", "卖点露头"],
    negativeSignals: ["前几百字只有背景说明", "危机很热闹但不知道卖什么", "外挂或身份只被介绍没有形成局面"],
    layers: [
      {
        id: "slow_start",
        name: "慢热层",
        diagnosis: ["前 300 到 500 字是否出现异常或压力", "主角是否只是被介绍而不是被推入局面"],
        repairFocus: ["提前冲突", "删背景", "用动作和选择介绍主角"],
      },
      {
        id: "selling_point",
        name: "卖点落地层",
        diagnosis: ["前 1500 到 3000 字是否能看见核心卖点", "卖点是否落在可感知局面里"],
        repairFocus: ["把设定变成麻烦", "让主角在卖点里做选择", "让读者知道下一步想看什么"],
      },
    ],
    beforeWritingPlan: ["第一眼异常", "主角亮相方式", "卖点露出点", "第一阻碍", "章末承接"],
    hardRules: ["开头不要先讲设定史", "抓手必须服务长期卖点", "黄金三章要形成递进而不是三个热闹片段"],
    outputContracts: [
      {
        taskKind: "opening",
        sections: ["开头问题诊断", "开头计划", "重写正文", "前三章递进建议"],
      },
    ],
    materialHints: [
      { query: "强异常局面开头", useFor: "学习如何快速成交" },
      { query: "关系压力开篇", useFor: "学习如何让人物和卖点同时亮相" },
    ],
  },
  {
    id: "volume_outline",
    name: "分卷章纲模块",
    stage: "outline",
    responsibility: "把故事引擎展开成黄金三章、第一卷目标、前 10 到 20 章章纲和卷末兑现点。",
    triggers: ["大纲", "分卷", "卷纲", "章纲", "前十章", "前 10 章", "前20章", "中段", "卷末"],
    negativeSignals: ["章纲像流水账", "每章没有变化", "第一卷没有兑现点", "中段支线乱长"],
    layers: [
      {
        id: "golden_three",
        name: "黄金三章层",
        diagnosis: ["前三章是否连续推进卖点", "第三章是否形成明确追读理由"],
        repairFocus: ["第一章成交", "第二章加压", "第三章立住长期问题"],
      },
      {
        id: "chapter_plan",
        name: "章纲层",
        diagnosis: ["每章是否有目标、阻碍、变化、钩子", "章节之间是否是因果推进而非并列罗列"],
        repairFocus: ["补目标和阻碍", "把变化写成局面差异", "设计卷末兑现"],
      },
    ],
    beforeWritingPlan: ["卷目标", "卷末变化", "前三章递进", "前 10 到 20 章节拍", "伏笔布置"],
    hardRules: ["长篇网文默认必须写章纲", "每章必须有变化", "卷末必须兑现或反转一个核心承诺"],
    outputContracts: [
      {
        taskKind: "outline",
        sections: ["总纲判断", "第一卷目标", "黄金三章", "前 10-20 章章纲", "伏笔账本", "风险提示"],
      },
    ],
    materialHints: [
      { query: "黄金三章推进", useFor: "借鉴早期节奏结构" },
      { query: "卷末兑现与新问题", useFor: "设计第一卷收束方式" },
    ],
  },
  {
    id: "plot_logic",
    name: "剧情逻辑模块",
    stage: "revision",
    responsibility: "修复动机、触发、决策、后果和兑现的因果链问题。",
    triggers: ["逻辑", "因果", "动机", "触发", "决策", "后果", "伏笔", "兑现", "反转", "误会", "掉马"],
    negativeSignals: ["人物突然行动", "事件偏偏现在发生但没有理由", "反转靠巧合", "一章发生了却没有后果"],
    layers: [
      {
        id: "motivation_trigger",
        name: "动机 / 触发层",
        diagnosis: ["人物为什么要做", "为什么现在必须做", "是否有外部压力或内部需求"],
        repairFocus: ["补触发物", "补代价", "补不得不选的原因"],
      },
      {
        id: "consequence_payoff",
        name: "后果 / 兑现层",
        diagnosis: ["决定是否改变局面", "伏笔是否有回收方向", "变化是否被下一章承接"],
        repairFocus: ["落后果", "补兑现", "让下一场从变化开始"],
      },
    ],
    beforeWritingPlan: ["上一章留下的因", "本章触发", "主角选择", "代价", "局面变化"],
    hardRules: ["不要用巧合代替触发", "不要用解释代替动机", "没有后果的事件默认删、并、压缩"],
    outputContracts: [
      {
        taskKind: "local_revision",
        sections: ["断裂位置", "因果链计划", "修复方案", "改写片段", "后续承接"],
      },
    ],
    materialHints: [
      { query: "人物决定前的触发", useFor: "学习如何让选择成立" },
      { query: "伏笔兑现和后果落地", useFor: "学习如何让事件改变局面" },
    ],
  },
  {
    id: "character_consistency",
    name: "人物一致性模块",
    stage: "revision",
    responsibility: "维护人物目标、情绪、关系、身体状态和声音连续性。",
    triggers: ["人设", "崩", "人物", "目标漂移", "情绪", "关系", "伤势", "疲劳", "口吻", "不像他"],
    negativeSignals: ["目标无故改变", "关系温度断片", "伤势或秘密被忘记", "所有人说话一个腔"],
    layers: [
      {
        id: "goal_emotion",
        name: "目标 / 情绪层",
        diagnosis: ["这章目标是否延续或有触发地改变", "情绪是否有来路和过渡"],
        repairFocus: ["补目标触发", "补情绪触发物", "补行为和情绪之间的桥"],
      },
      {
        id: "relationship_body_voice",
        name: "关系 / 身体 / 声音层",
        diagnosis: ["关系状态是否接住上一场", "身体和信息状态是否丢失", "口吻是否匹配人物"],
        repairFocus: ["补关系余波", "带上身体代价", "限定角色词汇和句式"],
      },
    ],
    beforeWritingPlan: ["人物当前目标", "情绪余波", "关系温度", "身体/信息状态", "声音边界"],
    hardRules: ["人物变化必须有触发", "关系升降温必须有事件", "身体和秘密状态不能被正文忘记"],
    outputContracts: [
      {
        taskKind: "local_revision",
        sections: ["人物状态表", "不一致点", "状态连续计划", "修复片段", "后续注意"],
      },
    ],
    materialHints: [
      { query: "关系状态承接", useFor: "学习如何带着上一场余波进入下一场" },
      { query: "人物声音差异", useFor: "学习口吻区分" },
    ],
  },
  {
    id: "transition",
    name: "转场模块",
    stage: "drafting",
    responsibility: "处理时间跳切、空间切换、情绪承接、视角切换、回忆梦境边界和章末接下章。",
    triggers: ["转场", "跳切", "切场", "时间", "空间", "承接", "视角", "回忆", "梦境", "下一场"],
    negativeSignals: ["第二天式硬跳", "到了某地但没有戏", "情绪刚起就换场", "视角切换没有边界"],
    layers: [
      {
        id: "bridge",
        name: "桥梁层",
        diagnosis: ["上一拍留下什么力", "下一拍必须接什么变化", "中间缺动作、物件还是信息"],
        repairFocus: ["补桥梁动作", "补触发物", "补共同事件"],
      },
      {
        id: "rhythm",
        name: "网文章节节奏层",
        diagnosis: ["转场是否削弱追读", "章末和下一场是否能接住"],
        repairFocus: ["在变化处切", "保留未解决压力", "让下一场从压力继续"],
      },
    ],
    beforeWritingPlan: ["上一拍余力", "缺失桥梁", "下一场第一拍", "不可丢状态", "切换方式"],
    hardRules: ["不要用空时间词糊过去", "转场要带状态和压力", "视角切换必须有边界"],
    outputContracts: [
      {
        taskKind: "local_revision",
        sections: ["转场问题", "桥梁计划", "改写片段", "状态承接检查"],
      },
    ],
    materialHints: [
      { query: "时间跳切但保留情绪", useFor: "学习非摘要式时间推进" },
      { query: "场景切换和物件触发", useFor: "学习自然转场方法" },
    ],
  },
  {
    id: "dialogue",
    name: "对白模块",
    stage: "drafting",
    responsibility: "让对白承担关系压力、人物声音、信息嵌入和局面推进。",
    triggers: ["对白", "台词", "说话", "口吻", "摊牌", "信息", "说明书", "声音", "火花"],
    negativeSignals: ["台词只是互相告知信息", "每个人都像旁白", "情绪很重但局面没变", "没有潜台词"],
    layers: [
      {
        id: "empty_dialogue",
        name: "空对白 / 说明书层",
        diagnosis: ["对白是否只传信息", "是否没有关系压力和立场冲突"],
        repairFocus: ["把信息变成试探或施压", "加入立场差", "让话语带目的"],
      },
      {
        id: "voice_pressure",
        name: "声音 / 压力层",
        diagnosis: ["人物声音是否可区分", "对白后局面是否变化"],
        repairFocus: ["限定角色词库", "用短句和沉默制造刀口", "让一句话改变关系"],
      },
    ],
    beforeWritingPlan: ["双方各自目的", "隐藏信息", "关系压力", "谁掌握主动权", "一句改变局面的台词"],
    hardRules: ["不要让角色替作者解释设定", "每段对白至少改变信息、关系或局面之一", "人物声音必须服务身份和关系"],
    outputContracts: [
      {
        taskKind: "local_revision",
        sections: ["对白问题", "对白压力计划", "改写片段", "人物声音检查"],
      },
    ],
    materialHints: [
      { query: "高压关系对白", useFor: "学习话里藏刀" },
      { query: "信息嵌入对白", useFor: "学习不说明书式交代" },
    ],
  },
  {
    id: "chapter_ending",
    name: "章末模块",
    stage: "drafting",
    responsibility: "处理章末落点、余韵、回钩、追更拉力和下一章承接。",
    triggers: ["章末", "结尾", "收尾", "钩子", "追更", "拉力", "余韵", "下一章"],
    negativeSignals: ["收在总结上", "章末没有变化", "硬钩像广告", "下一章接不上"],
    layers: [
      {
        id: "landing",
        name: "落点层",
        diagnosis: ["章末是否收在变化上", "读者是否知道局面哪里不同了"],
        repairFocus: ["收在决定、发现、代价或关系变化上", "避免纯总结"],
      },
      {
        id: "aftertaste_hook",
        name: "后劲 / 回钩层",
        diagnosis: ["是否有未解压力", "下一章第一拍是否能接住"],
        repairFocus: ["留未完成动作", "回扣前文信息", "让问题具体而非空泛"],
      },
    ],
    beforeWritingPlan: ["本章变化", "章末落点", "未解压力", "下一章第一拍", "不能硬钩的地方"],
    hardRules: ["章末不要收在作者总结", "钩子必须来自本章变化", "下一章要能自然接住"],
    outputContracts: [
      {
        taskKind: "local_revision",
        sections: ["章末问题", "章末计划", "改写章末", "下一章承接"],
      },
    ],
    materialHints: [
      { query: "章末决定和局面变化", useFor: "学习追更落点" },
      { query: "情绪余韵收尾", useFor: "学习不硬钩的章末" },
    ],
  },
  {
    id: "anti_ai_voice",
    name: "去 AI 味模块",
    stage: "revision",
    responsibility: "清理空泛总结、套话氛围、说明书式对白、统一腔调和过度工整的段落节奏。",
    triggers: ["AI味", "AI 味", "机械", "模板", "空泛", "套话", "太工整", "说明书", "润色"],
    negativeSignals: ["情绪只被总结不被行动表现", "氛围依赖形容词堆叠", "句长过于平均", "所有人都说得完整正确"],
    layers: [
      {
        id: "abstract_summary",
        name: "空泛总结层",
        diagnosis: ["是否用抽象词替代动作", "是否把情绪讲完而不是演出来"],
        repairFocus: ["换成场内动作", "换成具体感官和选择", "保留含混和未说完"],
      },
      {
        id: "uniform_voice",
        name: "统一腔调层",
        diagnosis: ["角色是否都像同一个作者", "句子是否过度对称完整"],
        repairFocus: ["打散句式", "补停顿、误解和回避", "让角色只说自己会说的话"],
      },
    ],
    beforeWritingPlan: ["要删除的总结句", "要替换成的动作", "角色声音差异", "节奏破口", "保留的毛边"],
    hardRules: ["不要只换同义词", "不要把所有句子修得更顺", "去 AI 味要从场景动作和人物声音下手"],
    outputContracts: [
      {
        taskKind: "style_cleanup",
        sections: ["AI 味诊断", "替换计划", "改写片段", "自查结果"],
      },
    ],
    materialHints: [
      { query: "情绪动作化表达", useFor: "替换空泛总结" },
      { query: "不完整但有刀口的对白", useFor: "打破统一腔调" },
    ],
  },
  {
    id: "consistency_review",
    name: "完稿审查模块",
    stage: "review",
    responsibility: "章节完稿后的强制复查，统一检查剧情、人物、关系、身体信息、转场和章末承接。",
    triggers: ["审查", "检查", "评审", "完稿", "一致性", "质量", "问题", "验收"],
    negativeSignals: ["章节生成后直接交稿", "只看文风不看因果", "只改句子不更新记忆"],
    layers: [
      {
        id: "six_checks",
        name: "六项一致性层",
        diagnosis: ["剧情逻辑", "人物目标", "情绪关系", "身体信息", "场景转场", "章末承接"],
        repairFocus: ["列出风险", "定位责任模块", "决定是否允许交付"],
      },
    ],
    beforeWritingPlan: ["章纲目标", "实际完成", "新增事实", "人物状态变化", "待更新记忆"],
    hardRules: ["每章写完默认审查", "任意两项不稳先修再交付", "审查必须给出责任模块和修改建议"],
    outputContracts: [
      {
        taskKind: "chapter_review",
        sections: ["总评", "六项一致性检查", "问题清单", "责任模块", "修改建议", "是否通过"],
      },
    ],
    materialHints: [
      { query: "章节一致性审稿清单", useFor: "复核章节交付质量" },
    ],
  },
];

export const WEBNOVEL_MODULE_BY_ID: Record<WebnovelModuleId, WebnovelModuleDefinition> =
  WEBNOVEL_MODULES.reduce(
    (acc, module) => {
      acc[module.id] = module;
      return acc;
    },
    {} as Record<WebnovelModuleId, WebnovelModuleDefinition>,
  );

export const EXECUTION_PRIORITY: WebnovelModuleId[] = [
  "plot_logic",
  "character_consistency",
  "transition",
  "dialogue",
  "chapter_ending",
  "anti_ai_voice",
];

export const REQUIRED_CHAPTER_REVIEW_CHECKS = [
  "剧情逻辑一致性：关键事件是否有前提，关键决定是否有触发，关键变化是否有后果。",
  "人物目标一致性：主角本章目标是否清晰，过程中是否无故漂移。",
  "情绪与关系一致性：情绪是否有来路，关系温度是否承接上一场。",
  "身体与信息状态一致性：伤势、疲劳、秘密、误会、已知信息是否丢失。",
  "场景与转场一致性：读者是否会迷路，上一场余力是否被带到下一场。",
  "章末承接一致性：章末是否收在变化上，下一章第一拍是否能接住。",
];
