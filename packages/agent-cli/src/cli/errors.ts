export class CliUsageError extends Error {
  readonly exitCode = 2 as const;
}

export class CliBusinessError extends Error {
  readonly exitCode = 1 as const;
}
