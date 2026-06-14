import { inspiration, setting } from "@ai-novel-agents/agents";
import type { Foundation, Setting, Store } from "@ai-novel-agents/store";

import type { WorkflowDefinition } from "./engine.js";

// ---------- 生成基础盘 ----------

export interface GenerateFoundationInput {
  novelId: string;
  ideas: string;
  genrePreference?: string;
}

export const generateFoundationWorkflow: WorkflowDefinition<GenerateFoundationInput> = {
  id: "generateFoundation",
  title: "生成小说基础盘",
  inputHint: "novelId：小说 id；ideas：灵感文本；genrePreference：可选题材偏好",
  novelId: (input) => input.novelId,
  steps: [
    {
      id: "generate",
      title: "构思基础盘",
      retries: 1,
      async run(ctx) {
        const foundation = await inspiration.generateFoundation.run(
          { ideas: ctx.input.ideas, genrePreference: ctx.input.genrePreference },
          ctx.agents,
        );
        ctx.store.assets.saveVersion(ctx.input.novelId, "foundation", foundation);
        ctx.store.novels.update(ctx.input.novelId, {
          title: foundation.title,
          genre: foundation.genre,
          brief: foundation.logline,
        });
        return foundation;
      },
    },
  ],
};

// ---------- 生成设定 ----------

export interface GenerateSettingInput {
  novelId: string;
  extraNotes?: string;
}

export const generateSettingWorkflow: WorkflowDefinition<GenerateSettingInput> = {
  id: "generateSetting",
  title: "生成世界观与设定",
  inputHint: "novelId：小说 id；extraNotes：可选补充要求",
  novelId: (input) => input.novelId,
  steps: [
    {
      id: "generate",
      title: "构建世界观与角色",
      retries: 1,
      async run(ctx) {
        const foundation = requireFoundation(ctx.store, ctx.input.novelId);
        const result = await setting.generateSetting.run(
          { foundation, extraNotes: ctx.input.extraNotes },
          ctx.agents,
        );
        ctx.store.assets.saveVersion(ctx.input.novelId, "setting", result);
        persistCharacters(ctx.store, ctx.input.novelId, result);
        return result;
      },
    },
  ],
};

// ---------- 修改基础盘 / 设定 ----------

export interface ReviseAssetInput {
  novelId: string;
  kind: "foundation" | "setting";
  instruction: string;
}

export const reviseAssetWorkflow: WorkflowDefinition<ReviseAssetInput> = {
  id: "reviseAsset",
  title: "修改基础盘或设定",
  inputHint: "novelId：小说 id；kind：foundation|setting；instruction：修改指令",
  novelId: (input) => input.novelId,
  steps: [
    {
      id: "revise",
      title: "按指令修改",
      retries: 1,
      async run(ctx) {
        const { novelId, kind, instruction } = ctx.input;
        if (kind === "foundation") {
          const current = requireFoundation(ctx.store, novelId);
          const { content, revisionNote } = await inspiration.reviseFoundation.run(
            { current, instruction },
            ctx.agents,
          );
          ctx.store.assets.saveVersion(novelId, "foundation", content);
          ctx.store.novels.update(novelId, {
            title: content.title,
            genre: content.genre,
            brief: content.logline,
          });
          return { revisionNote };
        }

        const current = requireSetting(ctx.store, novelId);
        const foundation = requireFoundation(ctx.store, novelId);
        const { content, revisionNote } = await setting.reviseSetting.run(
          { foundation, current, instruction },
          ctx.agents,
        );
        ctx.store.assets.saveVersion(novelId, "setting", content);
        persistCharacters(ctx.store, novelId, content);
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

function persistCharacters(store: Store, novelId: string, setting: Setting): void {
  for (const character of setting.characters) {
    store.characters.upsert({
      novelId,
      name: character.name,
      role: character.role,
      profile: character.profile,
      firstChapterNo: 0,
    });
  }
}
