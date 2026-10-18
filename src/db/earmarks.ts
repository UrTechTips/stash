import { getAccount } from './accounts';
import type { Db } from './Db';
import type { Minor } from './types';

/** Money earmarked on each account by goals that are still active (bought or dropped goals release theirs). */
export async function earmarkedByAccount(db: Db): Promise<Record<number, Minor>> {
  const rows = await db.all<{ account_id: number; total: number }>(
    `SELECT a.account_id, SUM(a.amount) AS total
       FROM goal_allocations a JOIN goals g ON g.id = a.goal_id
      WHERE g.status = 'active' GROUP BY a.account_id`,
  );
  return Object.fromEntries(rows.map((r) => [r.account_id, r.total]));
}

export async function earmarkedOn(db: Db, accountId: number): Promise<Minor> {
  const row = await db.first<{ total: number | null }>(
    `SELECT SUM(a.amount) AS total FROM goal_allocations a JOIN goals g ON g.id = a.goal_id
      WHERE g.status = 'active' AND a.account_id = ?`,
    [accountId],
  );
  return row?.total ?? 0;
}

/**
 * Keeps the rule "earmarks on an account never exceed its balance". If money was spent or moved
 * out so that the balance dropped below what goals hold there, the lowest-priority goals release
 * the difference first. Call it inside the same transaction as the write that changed the balance.
 */
export async function trimEarmarks(db: Db, accountId: number, date: string): Promise<void> {
  const account = await getAccount(db, accountId);
  if (!account) return;
  let excess = (await earmarkedOn(db, accountId)) - Math.max(0, account.balance);
  if (excess <= 0) return;

  const holders = await db.all<{ goal_id: number; net: number }>(
    `SELECT g.id AS goal_id, SUM(a.amount) AS net
       FROM goal_allocations a JOIN goals g ON g.id = a.goal_id
      WHERE a.account_id = ? AND g.status = 'active'
      GROUP BY g.id, g.priority, g.created_at
     HAVING SUM(a.amount) > 0
      ORDER BY g.priority DESC, g.created_at DESC, g.id DESC`,
    [accountId],
  );
  for (const h of holders) {
    if (excess <= 0) break;
    const release = Math.min(h.net, excess);
    await db.run('INSERT INTO goal_allocations (goal_id, account_id, amount, date) VALUES (?, ?, ?, ?)', [
      h.goal_id,
      accountId,
      -release,
      date,
    ]);
    excess -= release;
  }
}
