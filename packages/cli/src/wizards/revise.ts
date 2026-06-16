import { reviseAssetWorkflow, reviseOutlineWorkflow } from "@ai-novel-agents/workflow";
import type { Foundation, Setting } from "@ai-novel-agents/store";

import { p, select, text } from "../clack.js";
import type { AppContext } from "../context.js";
import { editInEditor } from "../editor.js";
import { runWf } from "../runner.js";

// ---------- 修改基础盘 / 设定 ----------

export async function reviseAssetWizard(ctx: AppContext): Promise<void> {
  const kind = await select<"foundation" | "setting" | "back">({
    message: "修改哪个资产？",
    options: [
      { value: "foundation", label: "基础盘", hint: "定位/卖点/主角" },
      { value: "setting", label: "设定", hint: "世界观/角色/文风" },
      { value: "back", label: "返回" },
    ],
  });
  if (kind === "back") return;

  const useEditor = await select<"ai" | "manual" | "back">({
    message: "怎么改？",
    options: [
      { value: "ai", label: "告诉 AI 怎么改" },
      { value: "manual", label: "手工编辑 JSON（$EDITOR）" },
      { value: "back", label: "返回" },
    ],
  });
  if (useEditor === "back") return;

  if (useEditor === "manual") {
    const current = ctx.store.assets.getActive<Foundation | Setting>(ctx.currentNovelId, kind);
    if (!current) {
      p.log.warn("该资产尚未生成");
      return;
    }
    const edited = editInEditor(JSON.stringify(current.content, null, 2), "json");
    if (!edited) {
      p.log.message("未改动");
      return;
    }
    try {
      ctx.store.assets.saveVersion(ctx.currentNovelId, kind, JSON.parse(edited));
      p.log.success("已保存为新版本");
    } catch {
      p.log.error("JSON 解析失败，未保存");
    }
    return;
  }

  const instruction = await text({
    message: "想怎么改？",
    placeholder: "例：把主角的弱点改成「过度自信」，并强化反派动机",
    validate: (v) => (v.trim().length < 2 ? "请描述修改内容" : undefined),
  });
  const result = await runWf(ctx, reviseAssetWorkflow, {
    novelId: ctx.currentNovelId,
    kind,
    instruction: instruction.trim(),
  });
  showRevisionNote(result.outputs["revise"]);
}

// ---------- 修改大纲 ----------

export async function reviseOutlineWizard(ctx: AppContext): Promise<void> {
  const volumes = ctx.store.outlines.listActiveVolumes(ctx.currentNovelId);
  const scope = await select<"main" | "volume" | "back">({
    message: "修改总纲还是卷纲？",
    options: [
      { value: "main", label: "总纲" },
      { value: "volume", label: "卷纲", hint: volumes.length === 0 ? "暂无卷纲" : `${volumes.length} 卷` },
      { value: "back", label: "返回" },
    ],
  });
  if (scope === "back") return;

  let volumeNo: number | undefined;
  if (scope === "volume") {
    if (volumes.length === 0) {
      p.log.warn("还没有卷纲");
      return;
    }
    volumeNo = await select<number>({
      message: "改哪一卷？",
      options: [
        ...volumes.map((v) => ({
          value: v.content.volumeNo,
          label: `第 ${v.content.volumeNo} 卷 ${v.content.title}`,
        })),
        { value: 0, label: "返回" },
      ],
    });
    if (volumeNo === 0) return;
  }

  const instruction = await text({
    message: "想怎么改？",
    placeholder: "例：把第 2 卷的反派提前到第 3 章登场",
    validate: (v) => (v.trim().length < 2 ? "请描述修改内容" : undefined),
  });
  const result = await runWf(ctx, reviseOutlineWorkflow, {
    novelId: ctx.currentNovelId,
    scope,
    volumeNo,
    instruction: instruction.trim(),
  });
  showRevisionNote(result.outputs["revise"]);
}

function showRevisionNote(output: unknown): void {
  const note = (output as { revisionNote?: string } | undefined)?.revisionNote;
  if (note) {
    p.log.success(`已保存新版本：${note}`);
  }
}
