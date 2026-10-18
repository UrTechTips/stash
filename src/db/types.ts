import type { ISODate } from '../engine/dates';

export type Minor = number;

export type AccountType = 'cash' | 'bank' | 'wallet' | 'savings' | 'credit' | 'other';
export const ACCOUNT_TYPES: { value: AccountType; label: string; emoji: string }[] = [
  { value: 'cash', label: 'Cash', emoji: '💵' },
  { value: 'bank', label: 'Bank', emoji: '🏦' },
  { value: 'wallet', label: 'Wallet / UPI', emoji: '📱' },
  { value: 'savings', label: 'Savings', emoji: '🐷' },
  { value: 'credit', label: 'Credit card', emoji: '💳' },
  { value: 'other', label: 'Other', emoji: '📦' },
];

export interface Account {
  id: number;
  name: string;
  type: AccountType;
  openingBalance: Minor;
  /** Counts toward "liquid money". A locked fixed deposit would not. */
  isSpendable: boolean;
  archived: boolean;
  /** Derived: opening balance plus every transaction. Never stored. */
  balance: Minor;
}

export type CategoryKind = 'essential' | 'discretionary' | 'income';

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  archived: boolean;
}

export type TxType = 'expense' | 'income' | 'transfer';

export interface TxInput {
  type: TxType;
  amount: Minor;
  date: ISODate;
  accountId: number;
  /** Transfers only. */
  toAccountId?: number | null;
  categoryId?: number | null;
  note?: string;
  goalId?: number | null;
  recurringId?: number | null;
}

export interface Transaction {
  id: number;
  type: TxType;
  amount: Minor;
  date: ISODate;
  accountId: number;
  toAccountId: number | null;
  categoryId: number | null;
  note: string;
  goalId: number | null;
  recurringId: number | null;
  createdAt: string;
}

/** A transaction with the names a list needs. */
export interface TransactionRow extends Transaction {
  accountName: string;
  toAccountName: string | null;
  categoryName: string | null;
  categoryIcon: string | null;
  categoryColor: string | null;
}

export interface TxFilter {
  from?: ISODate;
  to?: ISODate;
  accountId?: number;
  categoryId?: number;
  type?: TxType;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface BudgetView {
  /** 'YYYY-MM' the numbers apply to. */
  month: string;
  total: Minor;
  carryOver: boolean;
  /** categoryId -> monthly limit. */
  limits: Record<number, Minor>;
  /** Set when this month had no budget of its own and is using an earlier month's. */
  inheritedFrom?: string;
}

export type Cadence = 'weekly' | 'monthly' | 'yearly';

export interface RecurringRule {
  id: number;
  type: 'expense' | 'income';
  amount: Minor;
  accountId: number;
  categoryId: number | null;
  note: string;
  cadence: Cadence;
  nextDue: ISODate;
  /** Day of the month a monthly or yearly rule is anchored to. */
  anchorDay: number;
  active: boolean;
}

export type GoalStatus = 'active' | 'bought' | 'dropped';

export interface Goal {
  id: number;
  name: string;
  price: Minor;
  type: 'want' | 'need' | 'gift';
  /** 1 = high, 2 = medium, 3 = low. */
  priority: number;
  targetDate: ISODate | null;
  url: string | null;
  createdAt: ISODate;
  status: GoalStatus;
  expectedUses: number | null;
  purchasedTransactionId: number | null;
  /** Amount you plan to set aside each month. */
  monthlyPlan: Minor;
  /** Derived: the sum of this goal's allocations. */
  saved: Minor;
}

export interface GoalInputData {
  name: string;
  price: Minor;
  type: Goal['type'];
  priority: number;
  targetDate?: ISODate | null;
  url?: string | null;
  expectedUses?: number | null;
  monthlyPlan?: Minor;
}
