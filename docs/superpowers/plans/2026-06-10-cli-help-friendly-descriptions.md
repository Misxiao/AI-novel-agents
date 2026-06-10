# CLI Help 友好描述 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 CLI 顶层帮助和分组帮助直接说明用户可以完成什么任务，不再展示“几个命令”。

**Architecture:** 在 `CommandRegistry` 内维护一份有序的帮助分区元数据，顶层帮助按分区渲染已注册入口，分组帮助复用同一份用途描述。命令解析、执行和单命令帮助不变，未配置专门文案的分组继续使用通用回退格式。

**Tech Stack:** TypeScript、Node.js、tsx、pnpm workspace

---

### Task 1: 锁定友好的帮助输出

**Files:**
- Modify: `packages/agent-cli/src/cli/core.test.ts`

- [ ] **Step 1: 添加顶层帮助失败测试**

在 `testHelpComesFromRegistry` 中增加断言：

```ts
assertOk(rootHelp.includes("创作命令:"));
assertOk(rootHelp.includes("查询命令:"));
assertOk(rootHelp.includes("创建、查看和管理小说项目"));
assertOk(!rootHelp.includes("个命令"));
```

测试注册表补充 `asset show`，确保查询分区会实际渲染。

- [ ] **Step 2: 添加分组帮助失败测试**

增加以下断言：

```ts
assertOk(groupHelp.includes("novel - 创建、查看和管理小说项目"));
assertOk(groupHelp.includes("可用子命令:"));
assertOk(groupHelp.includes("输入 help novel <子命令> 查看详细说明。"));
```

再增加一个未配置文案的 `custom run` 命令，并验证通用回退：

```ts
const fallbackHelp = registry.buildHelp(["custom"]);
assertOk(fallbackHelp.includes("custom 命令:"));
assertOk(fallbackHelp.includes("custom run"));
```

- [ ] **Step 3: 运行测试并确认按预期失败**

Run:

```bash
pnpm --dir packages/agent-cli exec tsx src/cli/core.test.ts
```

Expected: FAIL，失败原因是顶层帮助缺少“创作命令:”或分组用途描述。

### Task 2: 实现帮助分区与用途描述

**Files:**
- Modify: `packages/agent-cli/src/cli/registry.ts`
- Test: `packages/agent-cli/src/cli/core.test.ts`

- [ ] **Step 1: 定义帮助分区元数据**

在 `registry.ts` 中添加内部常量，包含：

```ts
const HELP_SECTIONS = [
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
] as const;
```

从该常量生成分组用途查询，确保顶层和分组帮助共享同一份文案。

- [ ] **Step 2: 替换顶层数量统计**

在 `path.length === 0` 分支中：

1. 收集实际注册的首级入口。
2. 过滤掉没有注册的帮助项。
3. 跳过作为 `exit` 别名的 `quit`。
4. 按 `HELP_SECTIONS` 顺序输出分区、入口和用途描述。
5. 保留现有的进一步查询提示。

- [ ] **Step 3: 增强分组帮助**

当 `path.length > 0` 且没有精确命令时：

1. 如果首级入口存在用途文案，标题输出 `<分组> - <用途>`。
2. 输出空行和 `可用子命令:`。
3. 继续使用命令自身的 `summary` 展示每个子命令。
4. 结尾输出 `输入 help <分组> <子命令> 查看详细说明。`。
5. 未配置用途文案时保留 `<分组> 命令:` 通用标题。

- [ ] **Step 4: 运行核心测试并确认通过**

Run:

```bash
pnpm --dir packages/agent-cli exec tsx src/cli/core.test.ts
```

Expected: PASS，进程退出码为 0。

### Task 3: 回归与真实输出验证

**Files:**
- Verify: `packages/agent-cli/src/cli/registry.ts`
- Verify: `packages/agent-cli/src/cli/core.test.ts`

- [ ] **Step 1: 运行 CLI 包类型检查**

Run:

```bash
pnpm --dir packages/agent-cli typecheck
```

Expected: TypeScript 检查通过，退出码为 0。

- [ ] **Step 2: 验证真实顶层帮助**

Run:

```bash
pnpm --dir packages/agent-cli exec tsx src/index.ts help
```

Expected: 输出“创作命令”“查询命令”“工作台命令”，不包含“个命令”，不单独列出 `quit`。

- [ ] **Step 3: 验证真实分组帮助**

Run:

```bash
pnpm --dir packages/agent-cli exec tsx src/index.ts help novel
```

Expected: 首行说明 novel 分组用途，随后列出 `novel create`、`novel list`、`novel show`、`novel update`、`novel use` 及用途。

- [ ] **Step 4: 检查差异**

Run:

```bash
git diff --check -- packages/agent-cli/src/cli/registry.ts packages/agent-cli/src/cli/core.test.ts
```

Expected: 无输出，退出码为 0。
