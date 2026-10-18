import { assert, type Db } from './Db';
import type { Account, AccountType } from './types';

type Row = {
  id: number;
  name: string;
  type: AccountType;
  opening_balance: number;
  is_spendable: number;
  archived: number;
  balance: number;
};

// A balance is never stored: it is the opening balance plus every transaction that touches the account.
const SELECT_WITH_BALANCE = `
  SELECT a.*,
    a.opening_balance
    + COALESCE((SELECT SUM(CASE t.type WHEN 'income' THEN t.amount ELSE -t.amount END)
                FROM transactions t WHERE t.account_id = a.id), 0)
    + COALESCE((SELECT SUM(t.amount) FROM transactions t
                WHERE t.type = 'transfer' AND t.to_account_id = a.id), 0) AS balance
  FROM accounts a`;

const map = (r: Row): Account => ({
  id: r.id,
  name: r.name,
  type: r.type,
  openingBalance: r.opening_balance,
  isSpendable: r.is_spendable === 1,
  archived: r.archived === 1,
  balance: r.balance,
});

export async function listAccounts(db: Db, opts: { includeArchived?: boolean } = {}): Promise<Account[]> {
  const where = opts.includeArchived ? '' : 'WHERE a.archived = 0';
  return (await db.all<Row>(`${SELECT_WITH_BALANCE} ${where} ORDER BY a.archived, a.id`)).map(map);
}

export async function getAccount(db: Db, id: number): Promise<Account | null> {
  const row = await db.first<Row>(`${SELECT_WITH_BALANCE} WHERE a.id = ?`, [id]);
  return row ? map(row) : null;
}

/** Whether new money in this kind of account counts as spendable by default. Credit cards do not. */
export const defaultSpendable = (type: AccountType): boolean => type !== 'credit';

export interface AccountInput {
  name: string;
  type: AccountType;
  openingBalance: number;
  isSpendable?: boolean;
}

function validate(input: AccountInput) {
  assert(input.name.trim().length > 0, 'Give the account a name.');
  assert(input.name.trim().length <= 40, 'Keep the account name under 40 characters.');
  assert(Number.isInteger(input.openingBalance), 'The opening balance must be a whole number of paise.');
}

export async function createAccount(db: Db, input: AccountInput): Promise<number> {
  validate(input);
  const r = await db.run(
    'INSERT INTO accounts (name, type, opening_balance, is_spendable) VALUES (?, ?, ?, ?)',
    [input.name.trim(), input.type, input.openingBalance, (input.isSpendable ?? defaultSpendable(input.type)) ? 1 : 0],
  );
  return r.lastInsertRowId;
}

export async function updateAccount(db: Db, id: number, input: AccountInput): Promise<void> {
  validate(input);
  const r = await db.run(
    'UPDATE accounts SET name = ?, type = ?, opening_balance = ?, is_spendable = ? WHERE id = ?',
    [input.name.trim(), input.type, input.openingBalance, (input.isSpendable ?? defaultSpendable(input.type)) ? 1 : 0, id],
  );
  assert(r.changes === 1, 'That account no longer exists.');
}

/** Accounts with history are archived, not deleted, so old transactions keep their meaning. */
export async function setAccountArchived(db: Db, id: number, archived: boolean): Promise<void> {
  await db.run('UPDATE accounts SET archived = ? WHERE id = ?', [archived ? 1 : 0, id]);
}

export function summarizeAccounts(accounts: Account[]): { netWorth: number; liquid: number } {
  let netWorth = 0;
  let liquid = 0;
  for (const a of accounts) {
    if (a.archived) continue;
    netWorth += a.balance;
    if (a.isSpendable) liquid += a.balance;
  }
  return { netWorth, liquid };
}
