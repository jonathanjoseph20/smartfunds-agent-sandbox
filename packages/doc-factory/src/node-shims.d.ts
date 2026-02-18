declare module "node:crypto" {
  export function randomUUID(): string;
  export function createHash(algorithm: string): {
    update(value: string): { digest(encoding: "hex"): string };
    digest(encoding: "hex"): string;
  };
}

declare module "node:module" {
  export function createRequire(url: string): (id: string) => unknown;
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

declare module "node:fs" {
  export function rmSync(path: string, opts?: { force?: boolean }): void;
}

declare const process: {
  env: Record<string, string | undefined>;
};
