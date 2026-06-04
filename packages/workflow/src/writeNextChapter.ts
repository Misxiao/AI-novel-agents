import {
  ChapterAgent,
  type ChapterNovelInput,
  type ChapterPlanInput,
  type ChatModel,
  type WriteNextChapterContext,
  type WriteNextChapterOutput,
  type TokenUsage,
} from "../../agents/src/index.js";

export interface WriteNextChapterWorkflowInput {
  model?: ChatModel;
  novel: ChapterNovelInput;
  chapterPlan: ChapterPlanInput;
  context?: WriteNextChapterContext;
  targetWords?: number;
}

export interface WriteNextChapterWorkflowResult {
  task: {
    taskId: string;
    novelId: string;
    title: string;
    workflowName: "write-next-chapter";
    status: "succeeded";
    inputSnapshot: string;
    outputSnapshot: string;
    startedAt: string;
    finishedAt: string;
  };
  draft: WriteNextChapterOutput;
  agentRun: {
    agentId: "chapter";
    capabilityId: "chapter.writeNextChapter";
    provider: string;
    model: string;
    usage?: TokenUsage;
    startedAt: string;
    finishedAt: string;
  };
}

export async function runWriteNextChapterWorkflow(
  input: WriteNextChapterWorkflowInput,
): Promise<WriteNextChapterWorkflowResult> {
  const startedAt = new Date().toISOString();
  const chapterAgent = new ChapterAgent({ model: input.model });
  const agentResult = await chapterAgent.writeNextChapter({
    novel: input.novel,
    chapterPlan: input.chapterPlan,
    context: input.context,
    targetWords: input.targetWords,
  });
  const finishedAt = new Date().toISOString();

  return {
    task: {
      taskId: `task-write-next-chapter-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      novelId: input.novel.novelId,
      title: `写下一章：第 ${input.chapterPlan.chapterNo} 章`,
      workflowName: "write-next-chapter",
      status: "succeeded",
      inputSnapshot: `chapter.writeNextChapter：${input.chapterPlan.title}`,
      outputSnapshot: `已生成第 ${input.chapterPlan.chapterNo} 章正文草稿，约 ${agentResult.output.wordCount} 字。`,
      startedAt,
      finishedAt,
    },
    draft: agentResult.output,
    agentRun: {
      agentId: "chapter",
      capabilityId: "chapter.writeNextChapter",
      provider: agentResult.run.provider,
      model: agentResult.run.model,
      usage: agentResult.run.usage,
      startedAt: agentResult.run.startedAt,
      finishedAt: agentResult.run.finishedAt,
    },
  };
}
