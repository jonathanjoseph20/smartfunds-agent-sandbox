type Row = Record<string, unknown>;

export type DbLike = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    run: (...params: unknown[]) => void;
    all: (...params: unknown[]) => Row[];
    get: (...params: unknown[]) => Row | undefined;
  };
};

export function createFakeDb(): DbLike {
  // Minimal hermetic stub for unit tests.
  // If tests require richer behavior, we can extend deterministically later.
  return {
    exec: () => {},
    prepare: () => ({
      run: () => {},
      all: () => [],
      get: () => undefined,
    }),
  };
}
