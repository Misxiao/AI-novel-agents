import { buildWriteNextChapterMessages } from "./writeNextChapterPrompt.js";

const messages = buildWriteNextChapterMessages({
  novel: {
    novelId: "novel-context-window",
    title: "回声城",
    genre: "悬疑",
    hook: "主角能听见死者回声。",
    targetReaders: "悬疑读者",
    totalChapters: 100,
    currentVolume: "第一卷",
  },
  chapterPlan: {
    id: "plan-4",
    novelId: "novel-context-window",
    chapterNo: 4,
    title: "第四声",
    volumeTitle: "第一卷",
    objective: "主角确认回声来自同一凶手。",
    hook: "他在空车厢听见自己的名字。",
    status: "已确认",
  },
  context: {
    previousChapters: [
      {
        chapterNo: 2,
        title: "第二声",
        summary: "第二章摘要",
        endingHook: "第二章钩子",
      },
      {
        chapterNo: 3,
        title: "第三声",
        summary: "第三章摘要",
        content: "第三章正文全文。",
        endingHook: "第三章钩子",
        endingExcerpt: "第三章结尾片段。",
      },
    ],
    previousChapterEnding: "第三章结尾片段。",
    nextChapters: [
      {
        chapterNo: 5,
        title: "第五声",
        summary: "第五章摘要",
        content: "第五章正文全文。",
        endingHook: "第五章钩子",
      },
    ],
  },
});

const userMessage = messages.find((message) => message.role === "user")?.content ?? "";

assertIncludes(userMessage, "前文章节窗口");
assertIncludes(userMessage, "第三章正文全文。");
assertIncludes(userMessage, "上一章结尾片段：第三章结尾片段。");
assertIncludes(userMessage, "后文章节窗口");
assertIncludes(userMessage, "第五章正文全文。");

function assertIncludes(text: string, expected: string) {
  if (!text.includes(expected)) {
    throw new Error(`断言失败：输出未包含 ${expected}`);
  }
}
