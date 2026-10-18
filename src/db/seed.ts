import type { Db } from './Db';
import type { CategoryKind } from './types';

/** Starting categories. Essential and Discretionary feed the Buy-or-Wait safety buffer and budget gate. */
export const DEFAULT_CATEGORIES: { name: string; kind: CategoryKind; icon: string; color: string }[] = [
  { name: 'Rent', kind: 'essential', icon: '🏠', color: '#2F7FD0' },
  { name: 'Groceries', kind: 'essential', icon: '🛒', color: '#17A06A' },
  { name: 'Transport', kind: 'essential', icon: '🚌', color: '#8A6D3B' },
  { name: 'Bills', kind: 'essential', icon: '💡', color: '#2F5FD0' },
  { name: 'Health', kind: 'essential', icon: '💊', color: '#C03F2B' },
  { name: 'Eating out', kind: 'discretionary', icon: '🍜', color: '#E08A1E' },
  { name: 'Games', kind: 'discretionary', icon: '🎮', color: '#6C4FD8' },
  { name: 'Shopping', kind: 'discretionary', icon: '🛍️', color: '#D0457A' },
  { name: 'Entertainment', kind: 'discretionary', icon: '🎬', color: '#7A4FD0' },
  { name: 'Salary', kind: 'income', icon: '💼', color: '#17A06A' },
  { name: 'Other income', kind: 'income', icon: '🎁', color: '#3BA08A' },
];

/** Adds the default categories once, on a database that has none. */
export async function seedIfEmpty(db: Db): Promise<void> {
  const row = await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM categories');
  if ((row?.n ?? 0) > 0) return;
  await db.transaction(async (tx) => {
    for (const c of DEFAULT_CATEGORIES) {
      await tx.run('INSERT INTO categories (name, kind, icon, color) VALUES (?, ?, ?, ?)', [c.name, c.kind, c.icon, c.color]);
    }
  });
}
