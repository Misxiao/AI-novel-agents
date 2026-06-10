import { PassThrough } from "node:stream";
import { TerminalCliIO } from "./terminalIO.js";

const input = new PassThrough();
const output = new PassThrough();
const error = new PassThrough();
const io = new TerminalCliIO({ input, output, error });

input.end("novel create\nnovel list\nexit\n");

assertEqual(await io.question("first> "), "novel create");
assertEqual(await io.question("second> "), "novel list");
assertEqual(await io.question("third> "), "exit");

io.close();

function assertEqual<T>(actual: T, expected: T) {
  if (actual !== expected) {
    throw new Error(`断言失败：expected ${String(expected)}, got ${String(actual)}`);
  }
}
