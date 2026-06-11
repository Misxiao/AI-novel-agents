import type {
  ChapterContextBundle,
  ChapterPlan,
  ForeshadowDirective,
} from "@ai-novel-agents/store";

export function renderList(title: string, items: string[] | undefined): string[] {
  const normalized = (items ?? []).map((item) => item.trim()).filter(Boolean);
  if (normalized.length === 0) {
    return [];
  }
  return [`${title}：`, ...normalized.map((item) => `- ${item}`)];
}

const DIRECTIVE_LABELS: Record<ForeshadowDirective["directive"], string> = {
  should_resolve: "本章必须回收",
  should_advance: "本章应当推进",
  keep_alive: "保持存在感，不可遗忘",
};

/** 把装配好的上下文包渲染为中文 prompt 段落（plan/writer/reviewer/memory 共用） */
export function renderContextBundle(bundle: ChapterContextBundle): string[] {
  const lines: string[] = [];

  lines.push("## 小说基础");
  lines.push(`书名：《${bundle.novel.title}》`);
  if (bundle.foundation) {
    lines.push(`题材：${bundle.foundation.genre}`);
    lines.push(`一句话定位：${bundle.foundation.logline}`);
    lines.push(`核心卖点：${bundle.foundation.hook}`);
    lines.push(`主冲突：${bundle.foundation.mainConflict}`);
    lines.push(`故事引擎：${bundle.foundation.storyEngine}`);
    lines.push(
      `主角：${bundle.foundation.protagonist.name}（${bundle.foundation.protagonist.identity}），` +
        `想要：${bundle.foundation.protagonist.want}，弱点：${bundle.foundation.protagonist.flaw}`,
    );
    lines.push(`基调：${bundle.foundation.tone}`);
  }

  lines.push("", `当前位置：第 ${bundle.volumeNo} 卷 第 ${bundle.chapterNo} 章`);

  if (bundle.volumeOutline) {
    lines.push("", "## 本卷卷纲");
    lines.push(`卷名：${bundle.volumeOutline.title}`);
    lines.push(`本卷目标：${bundle.volumeOutline.goal}`);
    lines.push(`章节范围：第 ${bundle.volumeOutline.chapterRange.from}-${bundle.volumeOutline.chapterRange.to} 章`);
    for (const beat of bundle.volumeOutline.beats) {
      lines.push(`- 第 ${beat.chapters} 章：${beat.summary}`);
    }
    lines.push(`卷末钩子：${bundle.volumeOutline.endingHook}`);
  }

  if (bundle.globalRecap) {
    lines.push("", "## 全局前情提要", bundle.globalRecap);
  }
  if (bundle.volumeSummaries.length > 0) {
    lines.push("", "## 已完结卷摘要");
    for (const summary of bundle.volumeSummaries) {
      lines.push(`第 ${summary.volumeNo} 卷：${summary.content}`);
    }
  }
  if (bundle.recentChapterSummaries.length > 0) {
    lines.push("", "## 最近章节摘要");
    for (const summary of bundle.recentChapterSummaries) {
      lines.push(`第 ${summary.chapterNo} 章：${summary.content}`);
    }
  }
  if (bundle.previousChapterText) {
    lines.push("", "## 上一章正文（承接其结尾）", bundle.previousChapterText);
  }

  if (bundle.foreshadowDirectives.length > 0) {
    lines.push("", "## 伏笔指令（必须严格执行）");
    for (const directive of bundle.foreshadowDirectives) {
      lines.push(...renderForeshadowDirective(directive));
    }
  }

  if (bundle.activeCharacters.length > 0) {
    lines.push("", "## 出场角色状态（含最近演变，不得与之矛盾）");
    for (const entry of bundle.activeCharacters) {
      const profile = entry.character.profile;
      lines.push(
        `### ${entry.character.name}（${entry.character.role === "protagonist" ? "主角" : entry.character.role === "major" ? "主要角色" : "次要角色"}）`,
      );
      lines.push(`身份：${profile.identity}；性格：${profile.personality}；长线欲望：${profile.want}`);
      if (profile.voice) {
        lines.push(`说话方式：${profile.voice}`);
      }
      for (const state of entry.recentStates) {
        const parts = [
          state.goal && `目标=${state.goal}`,
          state.emotion && `情绪=${state.emotion}`,
          state.relationships && `关系=${state.relationships}`,
          state.physical && `身体=${state.physical}`,
          state.knowledge && `知情=${state.knowledge}`,
        ].filter(Boolean);
        lines.push(`- 第 ${state.chapterNo} 章后：${parts.join("；")}${state.changeNote ? `（${state.changeNote}）` : ""}`);
      }
    }
  }

  lines.push(...renderList("\n## 世界观硬规则", bundle.worldRules));

  if (bundle.canonFacts.length > 0) {
    lines.push("", "## 既成事实（canon，不得违背）");
    for (const fact of bundle.canonFacts) {
      lines.push(`- ${fact.subject}：${fact.fact}（第 ${fact.establishedChapterNo} 章确立）`);
    }
  }

  if (bundle.styleGuide) {
    lines.push("", "## 文风约束");
    lines.push(`叙事视角：${bundle.styleGuide.voice}`);
    lines.push(`节奏：${bundle.styleGuide.pacing}`);
    lines.push(...renderList("禁用表达", bundle.styleGuide.forbiddenExpressions));
  }

  return lines;
}

function renderForeshadowDirective(directive: ForeshadowDirective): string[] {
  const fs = directive.foreshadow;
  const lines = [
    `### 【${DIRECTIVE_LABELS[directive.directive]}】${fs.title}（id: ${fs.id}，重要度: ${fs.importance}）`,
    `内容：${fs.description}`,
  ];
  if (directive.history.length > 0) {
    lines.push(
      "轨迹：" +
        directive.history
          .map((event) => `第${event.chapterNo}章${eventLabel(event.event)}${event.note ? `（${event.note}）` : ""}`)
          .join(" → "),
    );
  }
  return lines;
}

function eventLabel(event: string): string {
  switch (event) {
    case "planted":
      return "埋设";
    case "advanced":
      return "推进";
    case "resolved":
      return "回收";
    default:
      return event;
  }
}

export function renderChapterPlan(plan: ChapterPlan): string[] {
  return [
    "## 本章章纲",
    `标题：${plan.title}`,
    `本章目标：${plan.objective}`,
    ...(plan.viewpoint ? [`视角：${plan.viewpoint}`] : []),
    "场景序列：",
    ...plan.scenes.map(
      (scene, index) =>
        `${index + 1}. 目的：${scene.purpose}；冲突：${scene.conflict}；结果：${scene.outcome}；人物：${scene.characters.join("、")}`,
    ),
    ...renderList(
      "伏笔动作",
      plan.foreshadowActions.map(
        (action) => `${action.foreshadowId}：${actionLabel(action.action)}——${action.how}`,
      ),
    ),
    ...renderList(
      "预期人物变化",
      plan.expectedCharacterChanges.map((change) => `${change.name}：${change.change}`),
    ),
    `章末钩子：${plan.endingHook}`,
    `目标字数：约 ${plan.targetWords} 字`,
  ];
}

function actionLabel(action: string): string {
  switch (action) {
    case "plant":
      return "埋设";
    case "advance":
      return "推进";
    case "resolve":
      return "回收";
    default:
      return action;
  }
}
