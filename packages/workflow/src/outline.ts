import { outline, reviewer } from "@ai-novel-agents/agents";
import type {
  Foundation,
  MainOutline,
  Setting,
  Store,
  VolumeOutline,
} from "@ai-novel-agents/store";

import type { WorkflowDefinition } from "./engine.js";
import { volumeChapterRanges } from "./helpers.js";

// ---------- 生成大纲（总纲 / 卷纲） ----------

export type GenerateOutlineInput =
  | { novelId: string; scope: "main"; volumeCount: number; chaptersPerVolume?: number }
  | { novelId: string; scope: "volume"; volumeNo: number };

export const generateOutlineWorkflow: WorkflowDefinition<GenerateOutlineInput> = {
  id: "generateOutline",
  title: "生成大纲",
  inputHint:
    "scope=main 时给 volumeCount；scope=volume 时给 volumeNo（需先有总纲）",
  novelId: (input) => input.novelId,
  steps: [
    {
      id: "generate",
      title: "构建大纲结构",
      retries: 1,
      async run(ctx) {
        const foundation = requireFoundation(ctx.store, ctx.input.novelId);
        if (ctx.input.scope === "main") {
          const setting = requireSetting(ctx.store, ctx.input.novelId);
          return outline.generateMainOutline.run(
            {
              foundation,
              setting,
              volumeCount: ctx.input.volumeCount,
              chaptersPerVolume: ctx.input.chaptersPerVolume,
            },
            ctx.agents,
          );
        }
        return generateVolume(ctx.store, ctx.agents, ctx.input.novelId, foundation, ctx.input.volumeNo);
      },
    },
    {
      id: "review",
      title: "结构自检",
      retries: 1,
      async run(ctx) {
        const foundation = requireFoundation(ctx.store, ctx.input.novelId);
        const outlineContent = ctx.prior<MainOutline | VolumeOutline>("generate");
        return reviewer.reviewOutline.run(
          { foundation, scope: ctx.input.scope, outline: outlineContent },
          ctx.agents,
        );
      },
    },
    {
      id: "persist",
      title: "保存大纲并登记伏笔",
      async run(ctx) {
        const { novelId, scope } = ctx.input;
        if (scope === "main") {
          const content = ctx.prior<MainOutline>("generate");
          ctx.store.outlines.saveVersion({ novelId, scope: "main", content });
          registerForeshadowSeeds(ctx.store, novelId, content);
          ctx.store.novels.update(novelId, { status: "writing" });
          return { volumes: content.volumes.length };
        }
        const content = ctx.prior<VolumeOutline>("generate");
        ctx.store.outlines.saveVersion({
          novelId,
          scope: "volume",
          volumeNo: content.volumeNo,
          content,
        });
        return { volumeNo: content.volumeNo };
      },
    },
  ],
};

async function generateVolume(
  store: Store,
  agents: Parameters<typeof outline.generateVolumeOutline.run>[1],
  novelId: string,
  foundation: Foundation,
  volumeNo: number,
): Promise<VolumeOutline> {
  const main = store.outlines.getActiveMain(novelId);
  if (!main) {
    throw new Error("尚未生成总纲，请先生成总纲");
  }
  const range = volumeChapterRanges(main.content).get(volumeNo);
  const startChapterNo = range?.from ?? store.chapters.nextChapterNo(novelId);
  const previousVolumeSummary = store.summaries.get(novelId, "volume", volumeNo - 1)?.content;

  return outline.generateVolumeOutline.run(
    {
      foundation,
      mainOutline: main.content,
      volumeNo,
      startChapterNo,
      previousVolumeSummary,
      openForeshadows: store.foreshadows.listOpen(novelId),
    },
    agents,
  );
}

// ---------- 修改大纲 ----------

export interface ReviseOutlineInput {
  novelId: string;
  scope: "main" | "volume";
  volumeNo?: number;
  instruction: string;
}

export const reviseOutlineWorkflow: WorkflowDefinition<ReviseOutlineInput> = {
  id: "reviseOutline",
  title: "修改大纲",
  inputHint: "scope：main|volume；volumeNo：卷号（卷纲时）；instruction：修改指令",
  novelId: (input) => input.novelId,
  steps: [
    {
      id: "revise",
      title: "按指令修改大纲",
      retries: 1,
      async run(ctx) {
        const { novelId, scope, volumeNo, instruction } = ctx.input;
        const foundation = requireFoundation(ctx.store, novelId);
        const current =
          scope === "main"
            ? ctx.store.outlines.getActiveMain(novelId)?.content
            : ctx.store.outlines.getActiveVolume(novelId, volumeNo!)?.content;
        if (!current) {
          throw new Error("找不到要修改的大纲版本");
        }
        const confirmedUpToChapter =
          scope === "volume" ? ctx.store.chapters.maxConfirmedChapterNo(novelId) : undefined;
        const { content, revisionNote } = await outline.reviseOutline.run(
          { scope, current, instruction, foundation, confirmedUpToChapter },
          ctx.agents,
        );
        ctx.store.outlines.saveVersion({
          novelId,
          scope,
          volumeNo: scope === "volume" ? volumeNo : undefined,
          content,
          revisionNote,
        });
        if (scope === "main") {
          registerForeshadowSeeds(ctx.store, novelId, content as MainOutline);
        }
        return { revisionNote };
      },
    },
  ],
};

// ---------- 共享 ----------

function requireFoundation(store: Store, novelId: string): Foundation {
  const asset = store.assets.getActive<Foundation>(novelId, "foundation");
  if (!asset) {
    throw new Error("尚未生成基础盘，请先创建基础盘");
  }
  return asset.content;
}

function requireSetting(store: Store, novelId: string): Setting {
  const asset = store.assets.getActive<Setting>(novelId, "setting");
  if (!asset) {
    throw new Error("尚未生成设定，请先生成设定");
  }
  return asset.content;
}

/** 把总纲中的伏笔种子登记进台账（按卷起止章号推导回收窗口），已存在同名则跳过 */
function registerForeshadowSeeds(store: Store, novelId: string, mainOutline: MainOutline): void {
  const ranges = volumeChapterRanges(mainOutline);
  for (const seed of mainOutline.foreshadowSeeds) {
    if (store.foreshadows.findByTitle(novelId, seed.title)) {
      continue;
    }
    const plantRange = ranges.get(seed.plantVolumeNo);
    const resolveRange = ranges.get(seed.resolveVolumeNo);
    store.foreshadows.create({
      novelId,
      title: seed.title,
      description: seed.description,
      importance: seed.importance,
      source: "outline",
      plantedChapterNo: plantRange?.from ?? 1,
      expectedResolveFrom: resolveRange?.from,
      expectedResolveTo: resolveRange?.to,
    });
  }
}
