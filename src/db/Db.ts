export type SqlValue = string | number | null;

export interface RunResult {
  lastInsertRowId: number;
  changes: number;
}

export interface Db {
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  all<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T[]>;
  first<T = Record<string, unknown>>(sql: string, params?: SqlValue[]): Promise<T | null>;
  /** Runs one or more statements with no parameters. */
  exec(sql: string): Promise<void>;
  /**
   * Runs `fn` as one atomic unit: everything inside commits together or not at all.
   * Calling `transaction` again inside `fn` simply joins the outer one.
   */
  transaction<T>(fn: (tx: Db) => Promise<T>): Promise<T>;
}

/** Thrown for input that is wrong rather than broken: the UI shows `message` to the user. */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new ValidationError(message);
}

// ---- change notifications: screens re-read when data changes ---------------------------

const listeners = new Set<() => void>();
let version = 0;
let scheduled = false;

export const getDataVersion = (): number => version;

export function subscribeToChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Tell every screen that data changed. Calls in the same tick are merged into one. */
export function notifyChange(): void {
  if (scheduled) return;
  scheduled = true;
  setTimeout(() => {
    scheduled = false;
    version += 1;
    listeners.forEach((l) => l());
  }, 0);
}

const WRITE = /^\s*(insert|update|delete|replace|create|drop|alter)\b/i;

/** Wraps a Db so that every committed write notifies the screens. */
export function withChangeEvents(db: Db): Db {
  return {
    async run(sql, params) {
      const result = await db.run(sql, params);
      if (WRITE.test(sql)) notifyChange();
      return result;
    },
    all: (sql, params) => db.all(sql, params),
    first: (sql, params) => db.first(sql, params),
    async exec(sql) {
      await db.exec(sql);
      notifyChange();
    },
    async transaction(fn) {
      const result = await db.transaction(fn);
      notifyChange();
      return result;
    },
  };
}
