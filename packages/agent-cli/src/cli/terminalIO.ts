import { createInterface, type Interface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import type { CliIO } from "./types.js";

interface TerminalCliIOOptions {
  input?: NodeJS.ReadableStream;
  output?: NodeJS.WritableStream;
  error?: NodeJS.WritableStream;
}

export class TerminalCliIO implements CliIO {
  private readonly readline: Interface;
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
    this.readline = createInterface({
      input: this.input,
      output: this.output,
      terminal: this.terminal,
    });

    if (this.terminal) {
      this.readline.on("SIGINT", () => {
        const now = Date.now();
        if (now - this.lastInterruptAt < 1500) {
          this.close();
          return;
        }
        this.lastInterruptAt = now;
        this.readline.write(null, { ctrl: true, name: "u" });
        this.output.write("\n输入已取消。再次按 Ctrl+C 或输入 exit 退出。\n");
      });
    } else {
      this.readline.on("line", (line) => this.acceptLine(line));
      this.readline.on("close", () => this.finishInput());
    }
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

  close() {
    this.readline.close();
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
