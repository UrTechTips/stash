import * as SQLite from 'expo-sqlite';
import type { Db, SqlValue } from './Db';

type Runner = Pick<SQLite.SQLiteDatabase, 'runAsync' | 'getAllAsync' | 'getFirstAsync' | 'execAsync'>;

function adapt(raw: Runner, transaction: Db['transaction']): Db {
  return {
    async run(sql, params = []) {
      const r = await raw.runAsync(sql, params as SqlValue[]);
      return { lastInsertRowId: r.lastInsertRowId, changes: r.changes };
    },
    all: <T,>(sql: string, params: SqlValue[] = []) => raw.getAllAsync<T>(sql, params as SqlValue[]),
    first: <T,>(sql: string, params: SqlValue[] = []) => raw.getFirstAsync<T>(sql, params as SqlValue[]),
    exec: (sql) => raw.execAsync(sql),
    transaction,
  };
}

/** Opens (or creates) the app's database in app-private storage. */
export async function openExpoDb(name = 'stash.db'): Promise<Db> {
  const raw = await SQLite.openDatabaseAsync(name);
  await raw.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const db: Db = adapt(raw, async (fn) => {
    let result!: Awaited<ReturnType<typeof fn>>;
    // An exclusive transaction runs on its own connection, so no other query can sneak in
    // between its statements.
    await raw.withExclusiveTransactionAsync(async (txn) => {
      const txDb: Db = adapt(txn, (inner) => inner(txDb)); // nested transaction() joins this one
      result = await fn(txDb);
    });
    return result;
  });
  return db;
}
