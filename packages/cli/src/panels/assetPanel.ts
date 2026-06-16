import { reviseAssetWorkflow } from "@ai-novel-agents/workflow";
import type { AssetKind, Foundation, Setting } from "@ai-novel-agents/store";

import { CancelError, p, select, text } from "../clack.js";
import type { AppContext } from "../context.js";
import { formatFoundation, formatSetting, formatVersions } from "../display.js";
import { editInEditor } from "../editor.js";
import { runWf } from "../runner.js";
import { section } from "../render/section.js";
import {
  generateFoundationWizard,
  generateSettingWizard,
} from "../wizards/generate.js";

const NAME: Record<AssetKind, string> = { foundation: "基础盘", setting: "设定" };

/** 资源面板：基础盘 / 设定 —— 进入后查看 / 修改 / 生成 / 看历史 */
export async function assetPanel(ctx: AppContext): Promise<void> {
  for (;;) {
    const hasFoundation = !!ctx.store.assets.getActive(ctx.currentNovelId, "foundation");
    const hasSetting = !!ctx.store.assets.getActive(ctx.currentNovelId, "setting");

    let kind: AssetKind | "back";
    try {
      kind = await select<AssetKind | "back">({
        message: "基础盘 / 设定",
        options: [
          { value: "foundation", label: "基础盘", hint: hasFoundation ? "已生成" : "待生成" },
          { value: "setting", label: "设定", hint: hasSetting ? "已生成" : "待生成" },
          { value: "back", label: "返回" },
        ],
      });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (kind === "back") return;

    try {
      await assetDetail(ctx, kind);
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

async function assetDetail(ctx: AppContext, kind: AssetKind): Promise<void> {
  const name = NAME[kind];
  for (;;) {
    const active = ctx.store.assets.getActive(ctx.currentNovelId, kind);
    const options = active
      ? [
          { value: "view", label: "查看" },
          { value: "ai", label: "AI 修改" },
          { value: "manual", label: "手工编辑（$EDITOR）" },
          { value: "history", label: "历史版本" },
          { value: "back", label: "返回" },
        ]
      : [
          { value: "generate", label: `生成${name}` },
          { value: "back", label: "返回" },
        ];

    let action: string;
    try {
      action = await select<string>({ message: name, options });
    } catch (error) {
      if (error instanceof CancelError) return;
      throw error;
    }
    if (action === "back") return;

    try {
      await handle(ctx, kind, action);
    } catch (error) {
      if (!(error instanceof CancelError)) throw error;
    }
  }
}

async function handle(ctx: AppContext, kind: AssetKind, action: string): Promise<void> {
  const name = NAME[kind];

  if (action === "generate") {
    await (kind === "foundation" ? generateFoundationWizard(ctx) : generateSettingWizard(ctx));
    return;
  }
  if (action === "view") {
    const content = ctx.store.assets.getActive(ctx.currentNovelId, kind)!.content;
    section(name, kind === "foundation" ? formatFoundation(content as Foundation) : formatSetting(content as Setting));
    return;
  }
  if (action === "history") {
    section(`${name}版本`, formatVersions(ctx.store.assets.listVersions(ctx.currentNovelId, kind)));
    return;
  }
  if (action === "manual") {
    const current = ctx.store.assets.getActive(ctx.currentNovelId, kind)!;
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
  // action === "ai"
  const instruction = await text({
    message: `想怎么改${name}？`,
    placeholder: "例：把主角的弱点改成「过度自信」，并强化反派动机",
    validate: (v) => (v.trim().length < 2 ? "请描述修改内容" : undefined),
  });
  const result = await runWf(ctx, reviseAssetWorkflow, {
    novelId: ctx.currentNovelId,
    kind,
    instruction: instruction.trim(),
  });
  const note = (result.outputs["revise"] as { revisionNote?: string } | undefined)?.revisionNote;
  if (note) p.log.success(`已保存新版本：${note}`);
}
