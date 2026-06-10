import type {
  CommandDefinition,
  ResolvedCommand,
} from "./types.js";

interface HelpSection {
  title: string;
  entries: ReadonlyArray<readonly [group: string, summary: string]>;
}

const HELP_SECTIONS: readonly HelpSection[] = [
  {
    title: "创作命令",
    entries: [
      ["novel", "创建、查看和管理小说项目"],
      ["preflight", "从创作想法生成基础盘、设定和初始大纲"],
      ["outline", "查看、修改和确认小说大纲"],
      ["chapter", "生成、评审并修订章节草稿"],
    ],
  },
  {
    title: "查询命令",
    entries: [
      ["asset", "查看小说基础盘、设定和大纲草案"],
      ["task", "查看工作流任务及运行结果"],
    ],
  },
  {
    title: "工作台命令",
    entries: [
      ["context", "查看当前小说和数据库位置"],
      ["help", "查看命令说明"],
      ["exit", "退出工作台"],
    ],
  },
];

const HELP_SUMMARIES = new Map<string, string>(
  HELP_SECTIONS.flatMap((section) => section.entries),
);

export class CommandRegistry {
  private readonly definitions: CommandDefinition[];

  constructor(definitions: CommandDefinition[] = []) {
    this.definitions = [];
    for (const definition of definitions) {
      this.register(definition);
    }
  }

  register(definition: CommandDefinition) {
    const key = definition.path.join(" ");
    if (!key) {
      throw new Error("命令路径不能为空。");
    }
    if (this.definitions.some((item) => item.path.join(" ") === key)) {
      throw new Error(`命令重复注册：${key}`);
    }
    this.definitions.push(definition);
    this.definitions.sort((left, right) => right.path.length - left.path.length);
  }

  resolve(tokens: string[]): ResolvedCommand | null {
    const definition = this.definitions.find((item) =>
      item.path.every((segment, index) => tokens[index] === segment)
    );
    return definition
      ? { definition, args: tokens.slice(definition.path.length) }
      : null;
  }

  buildHelp(path: string[] = []) {
    const exact = this.definitions.find((item) =>
      item.path.length === path.length
      && item.path.every((segment, index) => segment === path[index])
    );
    if (exact) {
      return [
        `${exact.path.join(" ")} - ${exact.summary}`,
        `用法: ${exact.usage}`,
        "示例:",
        ...exact.examples.map((example) => `  ${example}`),
      ].join("\n");
    }

    const matches = this.definitions
      .filter((item) => path.every((segment, index) => item.path[index] === segment))
      .sort((left, right) => left.path.join(" ").localeCompare(right.path.join(" ")));
    if (matches.length === 0) {
      return `没有找到帮助主题：${path.join(" ")}`;
    }

    if (path.length === 0) {
      const registeredGroups = new Set(matches.map((item) => item.path[0]!));
      const knownGroups = new Set(HELP_SUMMARIES.keys());
      const sectionLines = HELP_SECTIONS.flatMap((section) => {
        const entries = section.entries.filter(([group]) => registeredGroups.has(group));
        return entries.length === 0
          ? []
          : [
              `${section.title}:`,
              ...entries.map(([group, summary]) => `  ${group.padEnd(12)} ${summary}`),
              "",
            ];
      });
      const otherGroups = [...registeredGroups]
        .filter((group) => group !== "quit" && !knownGroups.has(group))
        .sort();
      if (otherGroups.length > 0) {
        sectionLines.push(
          "其他命令:",
          ...otherGroups.map((group) => `  ${group.padEnd(12)} 查看相关功能`),
          "",
        );
      }
      return [
        "AI 小说创作工作台",
        "",
        ...sectionLines,
        "输入 help <分组或命令> 查看详细说明。",
      ].join("\n");
    }

    const summary = path.length === 1
      ? HELP_SUMMARIES.get(path[0]!)
      : undefined;
    return [
      summary
        ? `${path.join(" ")} - ${summary}`
        : `${path.join(" ")} 命令:`,
      "",
      "可用子命令:",
      ...matches.map((item) => `  ${item.path.join(" ").padEnd(28)} ${item.summary}`),
      "",
      `输入 help ${path.join(" ")} <子命令> 查看详细说明。`,
    ].join("\n");
  }

  list() {
    return [...this.definitions];
  }
}
