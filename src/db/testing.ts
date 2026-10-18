// Test-only: a Db backed by Node's built-in SQLite (Node 22+), so repositories and migrations
// can be tested without a phone. Not imported by the app.
import { DatabaseSync, type SQLInputValue } from 'node:sqlite';
import type { Db } from './Db';

export function openMemoryDb(opts: { foreignKeys?: boolean } = {}): Db {
  const raw = new DatabaseSync(':memory:');
  raw.exec(`PRAGMA foreign_keys = ${opts.foreignKeys === false ? 'OFF' : 'ON'};`);
  let depth = 0;

  const db: Db = {
    async run(sql, params = []) {
      const r = raw.prepare(sql).run(...(params as SQLInputValue[]));
      return { lastInsertRowId: Number(r.lastInsertRowid), changes: Number(r.changes) };
    },
    async all<T>(sql: string, params: SQLInputValue[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async first<T>(sql: string, params: SQLInputValue[] = []) {
      return (raw.prepare(sql).get(...params) as T | undefined) ?? null;
    },
    async exec(sql) {
      raw.exec(sql);
    },
    async transaction(fn) {
      if (depth > 0) return fn(db); // join the outer transaction
      raw.exec('BEGIN');
      depth += 1;
      try {
        const result = await fn(db);
        raw.exec('COMMIT');
        return result;
      } catch (e) {
        raw.exec('ROLLBACK');
        throw e;
      } finally {
        depth -= 1;
      }
    },
  };
  return db;
}
