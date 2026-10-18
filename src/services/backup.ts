import { z } from 'zod';
import type { Db, SqlValue } from '../db/Db';
import { ValidationError } from '../db/Db';
import { LATEST_VERSION } from '../db/migrations';
import { minorToInput } from '../lib/money';

/**
 * Every table, listed parents first. Import deletes in reverse order and inserts in this order so
 * foreign keys always have something to point at.
 */
export const TABLES = [
  'categories',
  'accounts',
  'budgets',
  'budget_categories',
  'goals',
  'recurring_rules',
  'transactions',
  'goal_allocations',
  'settings',
] as const;

export interface BackupFile {
  app: 'stash';
  /** The database schema version the data was exported from. */
  schema: number;
  exportedAt: string;
  tables: Record<string, Record<string, SqlValue>[]>;
}

const backupSchema = z.object({
  app: z.literal('stash'),
  schema: z.number().int().min(1),
  exportedAt: z.string(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()])))),
});

/** All of the user's data as plain JSON. */
export async function exportData(db: Db, now: Date = new Date()): Promise<BackupFile> {
  const tables: BackupFile['tables'] = {};
  for (const t of TABLES) tables[t] = await db.all<Record<string, SqlValue>>(`SELECT * FROM ${t}`);
  return { app: 'stash', schema: LATEST_VERSION, exportedAt: now.toISOString(), tables };
}

export interface ImportSummary {
  accounts: number;
  transactions: number;
  goals: number;
}

/**
 * Replaces everything with the contents of a backup, atomically: if anything is wrong the
 * database is left exactly as it was. Throws ValidationError with a readable message.
 */
export async function importData(db: Db, raw: unknown): Promise<ImportSummary> {
  const parsed = backupSchema.safeParse(raw);
  if (!parsed.success) throw new ValidationError('That file is not a Stash backup.');
  const backup = parsed.data;
  if (backup.schema > LATEST_VERSION) {
    throw new ValidationError('This backup is from a newer version of Stash. Update the app first.');
  }

  await db.transaction(async (tx) => {
    // only columns that really exist are written, so a crafted file cannot inject SQL through a key
    const columns: Record<string, Set<string>> = {};
    for (const t of TABLES) {
      const info = await tx.all<{ name: string }>(`PRAGMA table_info(${t})`);
      columns[t] = new Set(info.map((c) => c.name));
    }

    for (const t of [...TABLES].reverse()) await tx.run(`DELETE FROM ${t}`);

    for (const t of TABLES) {
      for (const row of backup.tables[t] ?? []) {
        const keys = Object.keys(row).filter((k) => columns[t].has(k));
        if (keys.length === 0) continue;
        await tx.run(
          `INSERT INTO ${t} (${keys.join(', ')}) VALUES (${keys.map(() => '?').join(', ')})`,
          keys.map((k) => row[k]),
        );
      }
    }

    // Foreign-key enforcement can be off on some connections, so check explicitly. Throwing here
    // rolls the whole import back.
    const broken = await tx.all('PRAGMA foreign_key_check');
    if (broken.length > 0) throw new ValidationError('This backup is inconsistent (it refers to items that are missing), so it was not restored.');
  });

  return {
    accounts: backup.tables.accounts?.length ?? 0,
    transactions: backup.tables.transactions?.length ?? 0,
    goals: backup.tables.goals?.length ?? 0,
  };
}

const csvCell = (v: string): string => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** Transactions as CSV for a spreadsheet, newest first. Amounts are plain decimals (250.50). */
export async function transactionsCsv(db: Db): Promise<string> {
  const rows = await db.all<{
    date: string;
    type: string;
    amount: number;
    account: string;
    to_account: string | null;
    category: string | null;
    note: string;
  }>(
    `SELECT t.date, t.type, t.amount, a.name AS account, ta.name AS to_account, c.name AS category, t.note
       FROM transactions t
       JOIN accounts a ON a.id = t.account_id
       LEFT JOIN accounts ta ON ta.id = t.to_account_id
       LEFT JOIN categories c ON c.id = t.category_id
      ORDER BY t.date DESC, t.id DESC`,
  );
  const lines = ['Date,Type,Amount,Account,To account,Category,Note'];
  for (const r of rows) {
    const amount = minorToInput(r.amount);
    lines.push(
      [r.date, r.type, amount.includes('.') ? amount.padEnd(amount.indexOf('.') + 3, '0') : amount + '.00', r.account, r.to_account ?? '', r.category ?? '', r.note]
        .map(csvCell)
        .join(','),
    );
  }
  return lines.join('\n') + '\n';
}
