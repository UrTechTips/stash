import type { TransactionRow } from '../db/types';
import type { AmountKind } from './AmountText';

/** Turns a stored transaction into the props a TransactionRow wants. */
export function txRowProps(t: TransactionRow): {
  title: string;
  subtitle: string;
  amountMinor: number;
  kind: AmountKind;
  emoji: string;
  tint: string;
} {
  const isTransfer = t.type === 'transfer';
  return {
    title: t.note || t.categoryName || (isTransfer ? 'Transfer' : 'No category'),
    subtitle: isTransfer ? `${t.accountName} → ${t.toAccountName ?? '?'}` : `${t.categoryName ?? 'No category'} · ${t.accountName}`,
    amountMinor: t.amount,
    kind: t.type,
    emoji: isTransfer ? '🔁' : (t.categoryIcon ?? '🏷️'),
    tint: isTransfer ? '#6B7F76' : (t.categoryColor ?? '#8A6D3B'),
  };
}
