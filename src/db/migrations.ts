import type { Db } from './Db';

/**
 * Numbered, append-only migrations. Never edit one that has shipped: add a new one.
 * The current number lives in the schema_version table.
 */
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: `
      CREATE TABLE accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('cash','bank','wallet','savings','credit','other')),
        opening_balance INTEGER NOT NULL DEFAULT 0,
        is_spendable INTEGER NOT NULL DEFAULT 1,
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('essential','discretionary','income')),
        icon TEXT NOT NULL DEFAULT '🏷️',
        color TEXT NOT NULL DEFAULT '#8A6D3B',
        archived INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('expense','income','transfer')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        date TEXT NOT NULL,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        to_account_id INTEGER REFERENCES accounts(id),
        category_id INTEGER REFERENCES categories(id),
        note TEXT NOT NULL DEFAULT '',
        goal_id INTEGER,
        recurring_id INTEGER,
        created_at TEXT NOT NULL
      );
      CREATE TABLE budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        month TEXT NOT NULL UNIQUE,
        total_amount INTEGER NOT NULL,
        carry_over INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE budget_categories (
        budget_id INTEGER NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
        category_id INTEGER NOT NULL REFERENCES categories(id),
        limit_amount INTEGER NOT NULL,
        PRIMARY KEY (budget_id, category_id)
      );
      CREATE TABLE recurring_rules (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL CHECK (type IN ('expense','income')),
        amount INTEGER NOT NULL CHECK (amount > 0),
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        category_id INTEGER REFERENCES categories(id),
        note TEXT NOT NULL DEFAULT '',
        cadence TEXT NOT NULL CHECK (cadence IN ('weekly','monthly','yearly')),
        next_due TEXT NOT NULL,
        anchor_day INTEGER NOT NULL DEFAULT 1,
        active INTEGER NOT NULL DEFAULT 1
      );
      CREATE TABLE goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price INTEGER NOT NULL CHECK (price > 0),
        type TEXT NOT NULL CHECK (type IN ('want','need','gift')),
        priority INTEGER NOT NULL DEFAULT 2,
        target_date TEXT,
        url TEXT,
        created_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','bought','dropped')),
        expected_uses INTEGER,
        purchased_transaction_id INTEGER,
        monthly_plan INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE goal_allocations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        goal_id INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
        account_id INTEGER NOT NULL REFERENCES accounts(id),
        amount INTEGER NOT NULL CHECK (amount <> 0),
        date TEXT NOT NULL
      );
      CREATE TABLE settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
  {
    version: 2,
    // Keeps lists and month totals fast with tens of thousands of transactions.
    sql: `
      CREATE INDEX idx_tx_date ON transactions(date);
      CREATE INDEX idx_tx_account ON transactions(account_id, date);
      CREATE INDEX idx_tx_to_account ON transactions(to_account_id);
      CREATE INDEX idx_tx_category ON transactions(category_id, date);
      CREATE INDEX idx_alloc_goal ON goal_allocations(goal_id);
    `,
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

export async function currentVersion(db: Db): Promise<number> {
  await db.exec('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER NOT NULL)');
  const row = await db.first<{ version: number }>('SELECT MAX(version) AS version FROM schema_version');
  return row?.version ?? 0;
}

export interface MigrateHooks {
  /** Called once, before any change, when an existing database is about to be upgraded. Write a backup here. */
  beforeMigrate?: (from: number, to: number) => Promise<void>;
}

/** Brings the database up to the latest version. Each step is atomic. Returns the final version. */
export async function migrate(db: Db, hooks: MigrateHooks = {}): Promise<number> {
  const from = await currentVersion(db);
  const pending = MIGRATIONS.filter((m) => m.version > from);
  if (pending.length === 0) return from;

  if (from > 0) await hooks.beforeMigrate?.(from, LATEST_VERSION);

  for (const m of pending) {
    await db.transaction(async (tx) => {
      await tx.exec(m.sql);
      await tx.run('DELETE FROM schema_version');
      await tx.run('INSERT INTO schema_version (version) VALUES (?)', [m.version]);
    });
  }
  return LATEST_VERSION;
}
