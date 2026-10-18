import { isISODate } from '../engine/dates';
import { getAccount } from './accounts';
import { getCategory } from './categories';
import { assert, type Db, type SqlValue } from './Db';
import { trimEarmarks } from './earmarks';
import type { Transaction, TransactionRow, TxFilter, TxInput } from './types';

type Row = {
  id: number;
  type: Transaction['type'];
  amount: number;
  date: string;
  account_id: number;
  to_account_id: number | null;
  category_id: number | null;
  note: string;
  goal_id: number | null;
  recurring_id: number | null;
  created_at: string;
  account_name?: string;
  to_account_name?: string | null;
  category_name?: string | null;
  category_icon?: string | null;
  category_color?: string | null;
};

const mapTx = (r: Row): Transaction => ({
  id: r.id,
  type: r.type,
  amount: r.amount,
  date: r.date,
  accountId: r.account_id,
  toAccountId: r.to_account_id,
  categoryId: r.category_id,
  note: r.note,
  goalId: r.goal_id,
  recurringId: r.recurring_id,
  createdAt: r.created_at,
});

const mapRow = (r: Row): TransactionRow => ({
  ...mapTx(r),
  accountName: r.account_name ?? '',
  toAccountName: r.to_account_name ?? null,
  categoryName: r.category_name ?? null,
  categoryIcon: r.category_icon ?? null,
  categoryColor: r.category_color ?? null,
});

const SELECT_ROWS = `
  SELECT t.*, a.name AS account_name, ta.name AS to_account_name,
         c.name AS category_name, c.icon AS category_icon, c.color AS category_color
    FROM transactions t
    JOIN accounts a ON a.id = t.account_id
    LEFT JOIN accounts ta ON ta.id = t.to_account_id
    LEFT JOIN categories c ON c.id = t.category_id`;

async function validate(db: Db, input: TxInput): Promise<void> {
  assert(Number.isInteger(input.amount) && input.amount > 0, 'Enter an amount greater than zero.');
  assert(input.amount <= 99_999_999_999, 'That amount is too large.');
  assert(isISODate(input.date), 'That date is not valid.');
  assert((input.note ?? '').length <= 200, 'Keep the note under 200 characters.');
  assert(await getAccount(db, input.accountId), 'Pick an account.');

  if (input.type === 'transfer') {
    assert(input.toAccountId != null, 'Pick the account the money goes to.');
    assert(input.toAccountId !== input.accountId, 'Pick two different accounts for a transfer.');
    assert(await getAccount(db, input.toAccountId), 'Pick the account the money goes to.');
    assert(input.categoryId == null, 'A transfer has no category.');
  } else {
    assert(input.toAccountId == null, 'Only a transfer has a destination account.');
    if (input.categoryId != null) {
      const category = await getCategory(db, input.categoryId);
      assert(category, 'That category no longer exists.');
      assert(
        input.type === 'income' ? category.kind === 'income' : category.kind !== 'income',
        input.type === 'income' ? 'Pick an income category.' : 'Pick an expense category.',
      );
    }
  }
}

/** Balances changed, so make sure goals never hold more than an account has. */
async function afterBalanceChange(db: Db, accountIds: (number | null | undefined)[], date: string) {
  for (const id of new Set(accountIds.filter((x): x is number => x != null))) {
    await trimEarmarks(db, id, date);
  }
}

export async function addTransaction(db: Db, input: TxInput): Promise<number> {
  await validate(db, input);
  return db.transaction(async (tx) => {
    const r = await tx.run(
      `INSERT INTO transactions (type, amount, date, account_id, to_account_id, category_id, note, goal_id, recurring_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.type,
        input.amount,
        input.date,
        input.accountId,
        input.type === 'transfer' ? (input.toAccountId ?? null) : null,
        input.categoryId ?? null,
        (input.note ?? '').trim(),
        input.goalId ?? null,
        input.recurringId ?? null,
        new Date().toISOString(),
      ],
    );
    await afterBalanceChange(tx, [input.accountId, input.toAccountId], input.date);
    return r.lastInsertRowId;
  });
}

export async function updateTransaction(db: Db, id: number, input: TxInput): Promise<void> {
  await validate(db, input);
  await db.transaction(async (tx) => {
    const before = await tx.first<Row>('SELECT * FROM transactions WHERE id = ?', [id]);
    assert(before, 'That transaction no longer exists.');
    await tx.run(
      `UPDATE transactions SET type = ?, amount = ?, date = ?, account_id = ?, to_account_id = ?,
              category_id = ?, note = ? WHERE id = ?`,
      [
        input.type,
        input.amount,
        input.date,
        input.accountId,
        input.type === 'transfer' ? (input.toAccountId ?? null) : null,
        input.categoryId ?? null,
        (input.note ?? '').trim(),
        id,
      ],
    );
    await afterBalanceChange(tx, [before.account_id, before.to_account_id, input.accountId, input.toAccountId], input.date);
  });
}

export async function deleteTransaction(db: Db, id: number): Promise<void> {
  await db.transaction(async (tx) => {
    const before = await tx.first<Row>('SELECT * FROM transactions WHERE id = ?', [id]);
    if (!before) return;
    await tx.run('DELETE FROM transactions WHERE id = ?', [id]);
    // a deleted purchase makes its goal active again
    if (before.goal_id != null) {
      await tx.run(
        `UPDATE goals SET status = 'active', purchased_transaction_id = NULL
          WHERE id = ? AND purchased_transaction_id = ?`,
        [before.goal_id, id],
      );
    }
    await afterBalanceChange(tx, [before.account_id, before.to_account_id], before.date);
  });
}

export async function getTransaction(db: Db, id: number): Promise<TransactionRow | null> {
  const row = await db.first<Row>(`${SELECT_ROWS} WHERE t.id = ?`, [id]);
  return row ? mapRow(row) : null;
}

export async function listTransactions(db: Db, filter: TxFilter = {}): Promise<TransactionRow[]> {
  const where: string[] = [];
  const params: SqlValue[] = [];
  if (filter.from) (where.push('t.date >= ?'), params.push(filter.from));
  if (filter.to) (where.push('t.date <= ?'), params.push(filter.to));
  if (filter.accountId != null) (where.push('(t.account_id = ? OR t.to_account_id = ?)'), params.push(filter.accountId, filter.accountId));
  if (filter.categoryId != null) (where.push('t.category_id = ?'), params.push(filter.categoryId));
  if (filter.type) (where.push('t.type = ?'), params.push(filter.type));
  if (filter.search?.trim()) {
    const q = `%${filter.search.trim().replace(/[%_]/g, (c) => '\\' + c)}%`;
    where.push(`(t.note LIKE ? ESCAPE '\\' OR c.name LIKE ? ESCAPE '\\' OR a.name LIKE ? ESCAPE '\\')`);
    params.push(q, q, q);
  }
  let sql = `${SELECT_ROWS} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY t.date DESC, t.id DESC`;
  if (filter.limit != null) {
    sql += ' LIMIT ? OFFSET ?';
    params.push(filter.limit, filter.offset ?? 0);
  }
  return (await db.all<Row>(sql, params)).map(mapRow);
}
