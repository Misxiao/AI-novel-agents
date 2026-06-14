import * as p from "@clack/prompts";

export { p };

/** 用户取消（Ctrl+C / Esc）时抛出，由上层捕获并返回菜单 */
export class CancelError extends Error {
  constructor() {
    super("已取消");
    this.name = "CancelError";
  }
}

export function unwrap<T>(value: T | symbol): T {
  if (p.isCancel(value)) {
    throw new CancelError();
  }
  return value as T;
}

export async function text(opts: Parameters<typeof p.text>[0]): Promise<string> {
  return unwrap(await p.text(opts));
}

export async function select<T>(opts: {
  message: string;
  options: Array<{ value: T; label: string; hint?: string }>;
  initialValue?: T;
}): Promise<T> {
  return unwrap(await p.select(opts as never)) as T;
}

export async function confirm(message: string, initialValue = true): Promise<boolean> {
  return unwrap(await p.confirm({ message, initialValue }));
}
