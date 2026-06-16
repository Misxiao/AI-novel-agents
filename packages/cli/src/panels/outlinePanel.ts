import { reviseOutlineWorkflow } from "@ai-novel-agents/workflow";

import { CancelError, p, select, text } from "../clack.js";
import type { AppContext } from "../context.js";
import { formatMainOutline, formatVolumeOutline, formatVersions } from "../display.js";
import { runWf } from "../runner.js";
import { section } from "../render/section.js";
import {
  generateMainOutlineWizard,
  generateVolumeOutlineWizard,
} from "../wizards/generate.js";

/** 资源面板：大纲 —— 总纲与各卷卷纲的查看 / 修改 / 生成 / 历史 */
export async function outlinePanel(ctx: AppContext): Promise<void> {
  for (;;) {
    const main = ctx.store.outlines.getActiveMain(ctx.currentNovelId);
    const options = main
      ? [
          { value: "viewMain", label: "查看总纲" },
          { value: "editMain", label: "修改总纲" },
          { value: "volumes", label: "卷纲…", hint: `${ctx.store.outlines.listActiveVolumes(ctx.currentNovelId).length} 卷已生成` },
          { value: "history", label: "总纲历史版本" },
          { value: "back", label: "返回" },
        ]
      : [
          { value: "genMain", label: "生成总纲" },
          { value: "back", label: "返回" },
        ];

    let action: string;
    try {
      action = await select<string>({ message: "大纲", options });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (action === "back") return;

    try {
      if (action === "genMain") await generateMainOutlineWizard(ctx);
      else if (action === "viewMain") section("总纲", formatMainOutline(main!.content));
      else if (action === "editMain") await editOutline(ctx, "main");
      else if (action === "history")
        section("总纲版本", formatVersions(ctx.store.outlines.listVersions(ctx.currentNovelId, "main")));
      else if (action === "volumes") await volumeMenu(ctx);
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

async function volumeMenu(ctx: AppContext): Promise<void> {
  for (;;) {
    const main = ctx.store.outlines.getActiveMain(ctx.currentNovelId)!;
    const activeVolumes = ctx.store.outlines.listActiveVolumes(ctx.currentNovelId);
    const generated = new Set(activeVolumes.map((v) => v.content.volumeNo));
    const nextToGen = main.content.volumes.find((v) => !generated.has(v.volumeNo))?.volumeNo;

    const options = [
      ...activeVolumes.map((v) => ({
        value: `v${v.content.volumeNo}`,
        label: `第 ${v.content.volumeNo} 卷 ${v.content.title}`,
      })),
      ...(nextToGen ? [{ value: "gen", label: `生成第 ${nextToGen} 卷卷纲` }] : []),
      { value: "back", label: "返回" },
    ];

    let action: string;
    try {
      action = await select<string>({ message: "卷纲", options });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (action === "back") return;

    try {
      if (action === "gen" && nextToGen) await generateVolumeOutlineWizard(ctx, nextToGen);
      else if (action.startsWith("v")) await volumeDetail(ctx, Number(action.slice(1)));
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

async function volumeDetail(ctx: AppContext, volumeNo: number): Promise<void> {
  for (;;) {
    let action: string;
    try {
      action = await select<string>({
        message: `第 ${volumeNo} 卷卷纲`,
        options: [
          { value: "view", label: "查看" },
          { value: "edit", label: "修改" },
          { value: "history", label: "历史版本" },
          { value: "back", label: "返回" },
        ],
      });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (action === "back") return;

    try {
      if (action === "view") {
        const volume = ctx.store.outlines.getActiveVolume(ctx.currentNovelId, volumeNo);
        if (volume) section(`第 ${volumeNo} 卷卷纲`, formatVolumeOutline(volume.content));
      } else if (action === "edit") {
        await editOutline(ctx, "volume", volumeNo);
      } else if (action === "history") {
        section(
          `第 ${volumeNo} 卷版本`,
          formatVersions(ctx.store.outlines.listVersions(ctx.currentNovelId, "volume", volumeNo)),
        );
      }
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

async function editOutline(
  ctx: AppContext,
  scope: "main" | "volume",
  volumeNo?: number,
): Promise<void> {
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
  const note = (result.outputs["revise"] as { revisionNote?: string } | undefined)?.revisionNote;
  if (note) p.log.success(`已保存新版本：${note}`);
}
