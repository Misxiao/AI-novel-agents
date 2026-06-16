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
  // clack 在空提交时可能返回 undefined，统一兜成空串，调用方可安全 .trim()
  return unwrap(await p.text(opts)) ?? "";
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

export async function number(opts: {
  message: string;
  initialValue?: number;
  min?: number;
  max?: number;
}): Promise<number> {
  const fallback = opts.initialValue;
  const raw = await text({
    message: opts.message,
    placeholder: fallback != null ? String(fallback) : undefined,
    defaultValue: fallback != null ? String(fallback) : undefined,
    validate: (value) => {
      const s = value.trim();
      if (!s) return fallback != null ? undefined : "请输入数字";
      const n = Number(s);
      if (!Number.isInteger(n)) return "请输入整数";
      if (opts.min != null && n < opts.min) return `不能小于 ${opts.min}`;
      if (opts.max != null && n > opts.max) return `不能大于 ${opts.max}`;
      return undefined;
    },
  });
  const n = Number(raw.trim());
  return raw.trim() && Number.isFinite(n) ? n : (fallback ?? 0);
}

/** 预设项 + 「自定义输入…」：既能快选也能手填 */
export async function chooseNumber(opts: {
  message: string;
  options: number[];
  initialValue: number;
  min?: number;
  max?: number;
  unit?: string;
}): Promise<number> {
  const unit = opts.unit ?? "";
  const choice = await select<string>({
    message: opts.message,
    options: [
      ...opts.options.map((n) => ({ value: String(n), label: `${n}${unit}` })),
      { value: "__custom__", label: "自定义输入…" },
    ],
    initialValue: String(opts.initialValue),
  });
  if (choice !== "__custom__") {
    return Number(choice);
  }
  return number({
    message: `输入数字${unit ? `（${unit}）` : ""}`,
    initialValue: opts.initialValue,
    min: opts.min,
    max: opts.max,
  });
}
