import { createScriptedModel } from "@ai-novel-agents/agents";
import type { ChatCompletionInput, ModelRouter } from "@ai-novel-agents/llm";

/** 离线演练用的本地模型：按系统提示词分派，产出 schema 合法的占位内容 */
export function createMockRouter(): ModelRouter {
  const model = createScriptedModel([respond]);
  return () => model;
}

function respond(input: ChatCompletionInput): string {
  const system = input.messages[0]?.content ?? "";
  const user = input.messages.at(-1)?.content ?? "";
  const chapterNo = Number(user.match(/第\s*(\d+)\s*章/)?.[1] ?? 1);

  if (input.responseFormat !== "json_object") {
    return mockProse(chapterNo, user.includes("修订") || user.includes("润色"));
  }
  if (system.includes("策划编辑")) return j(mockFoundation());
  if (system.includes("世界观架构师")) return j(mockSetting());
  if (system.includes("大纲架构师")) {
    return user.includes("卷纲") ? j(mockVolumeOutline()) : j(mockMainOutline());
  }
  if (system.includes("结构编辑")) {
    return j({ score: 8.2, verdict: "结构扎实，递进清晰", issues: [], suggestions: ["可加强卷末钩子"] });
  }
  if (system.includes("主编")) return j(mockChapterPlan(chapterNo));
  if (system.includes("责编")) {
    return j({
      score: 8.4,
      verdict: "节奏紧凑，章末有拉力",
      dimensions: [
        { name: "节奏与获得感", score: 8, comment: "回报点清晰" },
        { name: "钩子与追读拉力", score: 9, comment: "章末悬念到位" },
        { name: "人物与对白", score: 8, comment: "动机连贯" },
        { name: "文字质感", score: 8, comment: "无明显 AI 腔" },
      ],
      revisionInstructions: [],
    });
  }
  if (system.includes("一致性审查员")) return j({ pass: true, violations: [] });
  if (system.includes("档案管理员") && user.includes("提取记忆")) {
    const foreshadowId = user.match(/id: (fs_[\w-]+)/)?.[1];
    return j({
      summary: `第 ${chapterNo} 章：主角推进了当前目标，局面出现新的变化。`,
      characterStates: [
        { name: "林尘", goal: "查清真相", emotion: "警惕", changeNote: `第 ${chapterNo} 章后立场更坚定` },
      ],
      foreshadowEvents: foreshadowId ? [{ foreshadowId, event: "advanced", note: "本章有新线索" }] : [],
      newForeshadows: [],
      canonFacts: [{ category: "event", subject: "林尘", fact: `第 ${chapterNo} 章建立的既成事实` }],
    });
  }
  if (system.includes("压缩成卷摘要")) return j({ content: "本卷主线推进到关键转折，主角完成阶段目标。" });
  if (system.includes("全局前情提要")) return j({ content: "故事开局至今：主角从底层起步，正逐步逼近核心真相。" });
  return j({});
}

function j(value: unknown): string {
  return JSON.stringify(value);
}

function mockProse(chapterNo: number, revised: boolean): string {
  const head = revised ? "（修订稿）" : "";
  const paragraph =
    "夜色像墨一样泼下来，林尘贴着冰冷的管壁，听着远处巡逻队的脚步由远及近。他屏住呼吸，指节因为用力而发白。" +
    "机会只有一次，他在心里默数，三、二、一——身形如同离弦的箭，窜进了那道狭窄的缝隙。星核的微光在掌心跳动，" +
    "灼热顺着血脉爬上心口，他咬牙忍住没有出声。";
  return `${head}${paragraph}\n\n`.repeat(16) + `这一章的较量到此为止，但更大的麻烦，才刚刚开始。`;
}

function mockFoundation() {
  return {
    title: "噬星者",
    genre: "星际玄幻",
    logline: "废土少年靠吞噬星核逆袭，追查姐姐失踪的真相",
    hook: "独一无二的星核吞噬体系",
    mainConflict: "人类残党与噬星文明的存亡之战",
    storyEngine: "吞噬不同星核解锁能力，每次升级牵出新的势力与谜题",
    protagonist: { name: "林尘", identity: "废星城拾荒少年", want: "找到失踪的姐姐", flaw: "不肯相信任何人" },
    targetReaders: "偏爱热血升级流的男频读者",
    tone: "热血中带悬疑",
  };
}

function mockSetting() {
  return {
    worldRules: ["星核不可再生，吞噬即消耗", "吞噬异属性星核会反噬神魂", "废土外是噬星文明的猎场"],
    powerSystem: "拾荒者→淬体→星核师→星主",
    locations: [
      { name: "废星城", description: "人类残党聚居的贫民窟，故事起点" },
      { name: "环带遗迹", description: "悬浮于轨道的古战场，藏有高阶星核" },
    ],
    characters: [
      {
        name: "林尘",
        role: "protagonist",
        profile: { identity: "拾荒少年", appearance: "瘦削，左眼有疤", personality: "外冷内热、谨慎", background: "孤儿，姐姐失踪", want: "找到姐姐", voice: "话少，句短" },
      },
      {
        name: "苏晚",
        role: "major",
        profile: { identity: "黑市情报贩子", personality: "精明、亦正亦邪", background: "消息网遍布废星城", want: "攒够离开废土的筹码", voice: "语速快，爱用反问" },
      },
    ],
    styleGuide: { voice: "第三人称限知，跟随林尘", pacing: "快节奏、强钩子", forbiddenExpressions: ["命运的齿轮开始转动", "一切都还没有结束", "他知道，这只是开始"] },
  };
}

function mockMainOutline() {
  return {
    premise: "拾荒少年觉醒吞噬之力，在废土与星空间一路逆袭，最终揭开姐姐失踪与噬星文明的真相。",
    protagonistArc: "从只求自保的拾荒者，成长为敢于直面文明存亡的星主。",
    volumes: [
      { volumeNo: 1, title: "废星初醒", goal: "在废星城站稳脚跟并觉醒吞噬之力", mainConflict: "巡逻队围剿与黑市倾轧", climax: "夺得第一枚高阶星核", estimatedChapters: 3 },
      { volumeNo: 2, title: "环带风云", goal: "潜入环带遗迹追查姐姐线索", mainConflict: "多方势力争夺遗迹", climax: "遗迹深处的真相碎片", estimatedChapters: 3 },
    ],
    foreshadowSeeds: [
      { title: "姐姐的下落", description: "姐姐失踪与星核中浮现的影像有关，最终揭示她仍活着", importance: "core", plantVolumeNo: 1, resolveVolumeNo: 2 },
      { title: "左眼的疤", description: "林尘左眼疤痕是被植入的星核碎片，关键时刻觉醒", importance: "major", plantVolumeNo: 1, resolveVolumeNo: 2 },
    ],
    ending: "林尘成为星主，揭开噬星文明真相，与姐姐重逢。",
  };
}

function mockVolumeOutline() {
  return {
    volumeNo: 1,
    title: "废星初醒",
    goal: "在废星城站稳脚跟并觉醒吞噬之力",
    chapterRange: { from: 1, to: 3 },
    beats: [
      { chapters: "1", summary: "拾荒遇险，意外吞噬第一枚星核，觉醒能力" },
      { chapters: "2", summary: "被黑市盯上，与苏晚结成临时同盟" },
      { chapters: "3", summary: "夺取高阶星核，初露锋芒，埋下追兵伏笔" },
    ],
    foreshadowPlan: [
      { foreshadowTitle: "姐姐的下落", action: "plant", aroundChapter: 1 },
      { foreshadowTitle: "左眼的疤", action: "plant", aroundChapter: 1 },
    ],
    endingHook: "高阶星核的主人盯上了林尘",
  };
}

function mockChapterPlan(chapterNo: number) {
  return {
    title: `第 ${chapterNo} 章 · 暗夜潜行`,
    objective: "林尘在巡逻队的封锁下夺取目标星核",
    viewpoint: "林尘",
    scenes: [
      { purpose: "潜入封锁区", conflict: "巡逻队的探照与陷阱", outcome: "险险摸到星核", characters: ["林尘"] },
      { purpose: "夺核反杀", conflict: "守卫突然出现", outcome: "吞噬星核、能力暴涨", characters: ["林尘", "苏晚"] },
    ],
    foreshadowActions: [],
    expectedCharacterChanges: [{ name: "林尘", change: "首次主动出击，信念更坚定" }],
    endingHook: "星核中浮现出一道熟悉的身影",
    targetWords: 2000,
  };
}
