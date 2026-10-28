import { useEffect, useState } from 'react';
import { Alert } from 'react-native';
import { useAction } from '../app-state/actions';
import { useApp, useQuery } from '../app-state/AppProvider';
import { onQuickAddRequested } from '../app-state/quickAdd';
import { listAccounts } from '../db/accounts';
import { listCategories } from '../db/categories';
import { earmarkedOn } from '../db/earmarks';
import { addTransaction } from '../db/transactions';
import type { TxType } from '../db/types';
import { formatMoney } from '../lib/money';
import { AddButton } from './AddButton';
import { QuickAddSheet, type QuickAddResult } from './QuickAddSheet';

export function QuickAddHost() {
  const { db, today } = useApp();
  const run = useAction();
  const [open, setOpen] = useState(false);
  const [initialType, setInitialType] = useState<TxType>('expense');

  useEffect(
    () =>
      onQuickAddRequested((type) => {
        setInitialType(type);
        setOpen(true);
      }),
    [],
  );

  const { data } = useQuery(async (d) => {
    const [accounts, categories, last] = await Promise.all([
      listAccounts(d),
      listCategories(d),
      d.first<{ account_id: number }>('SELECT account_id FROM transactions ORDER BY id DESC LIMIT 1'),
    ]);
    return { accounts, categories, lastAccountId: last?.account_id ?? null };
  });

  const save = async (r: QuickAddResult) => {
    const write = () =>
      run(() =>
        addTransaction(db, {
          type: r.type,
          amount: r.amountMinor,
          date: r.date,
          accountId: r.accountId,
          toAccountId: r.toAccountId,
          categoryId: r.categoryId,
          note: r.note,
        }),
      );

    // Spending money that goals have set aside takes it from them: say so before doing it.
    if (r.type !== 'income') {
      const account = data?.accounts.find((a) => a.id === r.accountId);
      const reserved = await earmarkedOn(db, r.accountId);
      const free = (account?.balance ?? 0) - reserved;
      if (account && reserved > 0 && r.amountMinor > free) {
        const use = Math.max(0, r.amountMinor - Math.max(0, free));
        Alert.alert(
          'This uses money set aside for goals',
          `${account.name} has ${formatMoney(Math.max(0, free))} free. The other ${formatMoney(use)} is set aside for your goals and will be released from the lowest-priority goal first.`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: async () => {
                if ((await write()) !== undefined) setOpen(false);
              },
            },
          ],
        );
        return;
      }
    }
    if ((await write()) !== undefined) setOpen(false);
  };

  if (!data) return null;
  return (
    <>
      <AddButton onPress={() => { setInitialType('expense'); setOpen(true); }} />
      <QuickAddSheet
        visible={open}
        today={today}
        initialType={initialType}
        defaultAccountId={data.lastAccountId}
        categories={data.categories.map((c) => ({ id: c.id, name: c.name, emoji: c.icon, kind: c.kind }))}
        accounts={data.accounts.map((a) => ({ id: a.id, name: a.name }))}
        onClose={() => setOpen(false)}
        onSave={save}
      />
    </>
  );
}
