import type { CliOptionValue, ParsedCommand } from "./types.js";

export function tokenizeCommandLine(line: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let quote: "'" | '"' | undefined;
  let escaping = false;

  for (const character of line.trim()) {
    if (escaping) {
      current += character;
      escaping = false;
      continue;
    }
    if (character === "\\") {
      escaping = true;
      continue;
    }
    if (quote) {
      if (character === quote) {
        quote = undefined;
      } else {
        current += character;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      continue;
    }
    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }
    current += character;
  }

  if (quote) {
    throw new Error("命令中存在未闭合的引号。");
  }
  if (escaping) {
    current += "\\";
  }
  if (current) {
    tokens.push(current);
  }
  return tokens;
}

export function parseCommandArgs(args: string[]): ParsedCommand {
  const positionals: string[] = [];
  const options: Record<string, CliOptionValue> = {};

  for (let index = 0; index < args.length; index += 1) {
    const token = args[index]!;
    if (!token.startsWith("--") || token === "--") {
      positionals.push(token);
      continue;
    }

    const raw = token.slice(2);
    const equalsIndex = raw.indexOf("=");
    if (equalsIndex >= 0) {
      appendOption(
        options,
        normalizeOptionName(raw.slice(0, equalsIndex)),
        raw.slice(equalsIndex + 1),
      );
      continue;
    }

    const name = normalizeOptionName(raw);
    const next = args[index + 1];
    if (next !== undefined && !next.startsWith("--")) {
      appendOption(options, name, next);
      index += 1;
    } else {
      appendOption(options, name, true);
    }
  }

  return { path: [], positionals, options };
}

function appendOption(
  options: Record<string, CliOptionValue>,
  name: string,
  value: string | boolean,
) {
  if (!name) {
    throw new Error("选项名称不能为空。");
  }
  const existing = options[name];
  if (existing === undefined) {
    options[name] = value;
    return;
  }
  options[name] = Array.isArray(existing)
    ? [...existing, String(value)]
    : [String(existing), String(value)];
}

function normalizeOptionName(name: string) {
  return name.trim();
}
