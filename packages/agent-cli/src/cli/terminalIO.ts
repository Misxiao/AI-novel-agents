import {
  clearScreenDown,
  cursorTo,
  emitKeypressEvents,
  moveCursor,
} from "node:readline";
import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { CliIO, CliSelectItem } from "./types.js";

interface TerminalCliIOOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  error?: NodeJS.WritableStream;
}

export class TerminalCliIO implements CliIO {
  private readline: Interface;
  private readonly input: NodeJS.ReadableStream;
  private readonly output: NodeJS.WritableStream;
  private readonly error: NodeJS.WritableStream;
  private readonly terminal: boolean;
  private readonly queuedLines: string[] = [];
  private readonly pendingQuestions: Array<{
    resolve: (line: string) => void;
    reject: (error: Error) => void;
  }> = [];
  private inputClosed = false;
  private lastInterruptAt = 0;
  private completionProvider?: (
    line: string,
  ) => [completions: string[], word: string];

  constructor(options: TerminalCliIOOptions = {}) {
    this.input = options.input ?? stdin;
    this.output = options.output ?? stdout;
    this.error = options.error ?? process.stderr;
    this.terminal = Boolean(
      "isTTY" in this.input
      && this.input.isTTY
      && "isTTY" in this.output
      && this.output.isTTY,
    );
    this.readline = this.createReadline();
  }

  write(message: string) {
    this.output.write(`${message}\n`);
  }

  writeError(message: string) {
    this.error.write(`${message}\n`);
  }

  question(prompt: string) {
    if (this.terminal) {
      return this.readline.question(prompt);
    }

    this.output.write(prompt);
    const queuedLine = this.queuedLines.shift();
    if (queuedLine !== undefined) {
      return Promise.resolve(queuedLine);
    }
    if (this.inputClosed) {
      return Promise.reject(new Error("输入已结束"));
    }

    return new Promise<string>((resolve, reject) => {
      this.pendingQuestions.push({ resolve, reject });
    });
  }

  setCompletionProvider(
    provider: (line: string) => [completions: string[], word: string],
  ) {
    this.completionProvider = provider;
  }

  async select(prompt: string, items: CliSelectItem[]) {
    const input = this.input as NodeJS.ReadStream;
    if (!this.terminal || typeof input.setRawMode !== "function") {
      return undefined;
    }

    this.readline.close();
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.resume();

    let query = "";
    let selectedIndex = 0;
    let renderedLines = 0;

    return new Promise<string | undefined>((resolve) => {
      const filteredItems = () => {
        const keyword = query.trim().toLocaleLowerCase();
        if (!keyword) return items;
        return items.filter((item) =>
          (item.searchText ?? item.label).toLocaleLowerCase().includes(keyword)
        );
      };

      const render = () => {
        const matches = filteredItems();
        selectedIndex = Math.min(selectedIndex, Math.max(0, matches.length - 1));
        const visibleStart = Math.max(0, selectedIndex - 7);
        const visible = matches.slice(visibleStart, visibleStart + 8);
        const lines = [
          `${prompt}（输入筛选，上下键选择，回车确认，Esc 取消）`,
          `筛选: ${query || "全部"}`,
          ...(visible.length > 0
            ? visible.map((item, index) =>
                `${visibleStart + index === selectedIndex ? ">" : " "} ${item.label}`
              )
            : ["  无匹配小说"]),
        ];
        if (renderedLines > 0) {
          moveCursor(this.output, 0, -renderedLines);
          cursorTo(this.output, 0);
          clearScreenDown(this.output);
        }
        this.output.write(`${lines.join("\n")}\n`);
        renderedLines = lines.length;
      };

      const finish = (value?: string) => {
        input.off("keypress", onKeypress);
        input.setRawMode(false);
        this.readline = this.createReadline();
        resolve(value);
      };

      const onKeypress = (
        text: string,
        key: { name?: string; ctrl?: boolean },
      ) => {
        const matches = filteredItems();
        if ((key.ctrl && key.name === "c") || key.name === "escape") {
          finish();
          return;
        }
        if (key.name === "return" || key.name === "enter") {
          finish(matches[selectedIndex]?.value);
          return;
        }
        if (key.name === "up") {
          selectedIndex = matches.length === 0
            ? 0
            : (selectedIndex - 1 + matches.length) % matches.length;
          render();
          return;
        }
        if (key.name === "down") {
          selectedIndex = matches.length === 0
            ? 0
            : (selectedIndex + 1) % matches.length;
          render();
          return;
        }
        if (key.name === "backspace") {
          query = Array.from(query).slice(0, -1).join("");
          selectedIndex = 0;
          render();
          return;
        }
        if (text && !key.ctrl && !/[\u0000-\u001f\u007f]/.test(text)) {
          query += text;
          selectedIndex = 0;
          render();
        }
      };

      input.on("keypress", onKeypress);
      render();
    });
  }

  close() {
    this.readline.close();
  }

  private createReadline() {
    const readline = createInterface({
      input: this.input,
      output: this.output,
      terminal: this.terminal,
      completer: (line) => this.completionProvider?.(line) ?? [[], ""],
    });

    if (this.terminal) {
      readline.on("SIGINT", () => {
        const now = Date.now();
        if (now - this.lastInterruptAt < 1500) {
          this.close();
          return;
        }
        this.lastInterruptAt = now;
        readline.write(null, { ctrl: true, name: "u" });
        this.output.write("\n输入已取消。再次按 Ctrl+C 或输入 exit 退出。\n");
      });
    } else {
      readline.on("line", (line) => this.acceptLine(line));
      readline.on("close", () => this.finishInput());
    }
    return readline;
  }

  private acceptLine(line: string) {
    const pending = this.pendingQuestions.shift();
    if (pending) {
      pending.resolve(line);
      return;
    }
    this.queuedLines.push(line);
  }

  private finishInput() {
    this.inputClosed = true;
    for (const pending of this.pendingQuestions.splice(0)) {
      pending.reject(new Error("输入已结束"));
    }
  }
}
