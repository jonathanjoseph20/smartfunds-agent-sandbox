declare module "node:crypto" {
  export function randomUUID(): string;
}

declare module "node:sqlite" {
  export class StatementSync {
    run(...params: unknown[]): void;
    get(...params: unknown[]): unknown;
    all(...params: unknown[]): unknown[];
  }

  export class DatabaseSync {
    constructor(path: string);
    exec(sql: string): void;
    prepare(sql: string): StatementSync;
  }
}

declare const process: {
  env: Record<string, string | undefined>;
};
