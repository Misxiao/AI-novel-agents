import type { AppContext } from "../context.js";

/** 新建一本空白小说，返回其 id；基础盘由后续「生成基础盘」向导填充 */
export function createNovel(ctx: AppContext): string {
  return ctx.store.novels.create({ title: "未命名" }).id;
}
