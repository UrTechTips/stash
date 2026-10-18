import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { confirm, useAction } from '../../app-state/actions';
import { useApp, useQuery } from '../../app-state/AppProvider';
import { Button, DateField, FormScreen, MoneyField, OptionChips, TextField } from '../../components';
import { listAccounts } from '../../db/accounts';
import { listCategories } from '../../db/categories';
import { deleteTransaction, getTransaction, updateTransaction } from '../../db/transactions';
import type { TxType } from '../../db/types';
import { minorToInput, parseToMinor } from '../../lib/money';
import { useTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

export default function EditTransaction() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { db, today } = useApp();
  const { colors } = useTheme();
  const run = useAction();
  const { data } = useQuery(async (d) => ({
    tx: await getTransaction(d, Number(id)),
    accounts: await listAccounts(d, { includeArchived: true }),
    categories: await listCategories(d, { includeArchived: true }),
  }), [id]);

  const [type, setType] = useState<TxType>('expense');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(today);
  const [accountId, setAccountId] = useState<number | null>(null);
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [loadedId, setLoadedId] = useState<number | null>(null);

  const tx = data?.tx;
  // Fill the form once when the saved data arrives (setting state while rendering is the supported way to do this).
  if (tx && tx.id !== loadedId) {
    setType(tx.type);
    setAmount(minorToInput(tx.amount));
    setDate(tx.date);
    setAccountId(tx.accountId);
    setToAccountId(tx.toAccountId);
    setCategoryId(tx.categoryId);
    setNote(tx.note);
    setLoadedId(tx.id);
  }

  if (!data) return <FormScreen title="Transaction"><Text /></FormScreen>;
  if (!tx) return <FormScreen title="Transaction"><Text style={[typography.body, { color: colors.textSecondary }]}>This transaction no longer exists.</Text></FormScreen>;

  const accounts = data.accounts.filter((a) => !a.archived || a.id === tx.accountId || a.id === tx.toAccountId);
  const kinds = data.categories.filter((c) => !c.archived || c.id === categoryId);
  const categoryOptions = kinds
    .filter((c) => (type === 'income' ? c.kind === 'income' : c.kind !== 'income'))
    .map((c) => ({ value: c.id, label: c.name, emoji: c.icon }));

  const save = async () => {
    const minor = parseToMinor(amount);
    const ok = await run(async () => {
      await updateTransaction(db, tx.id, {
        type,
        amount: minor ?? 0,
        date,
        accountId: accountId ?? 0,
        toAccountId,
        categoryId: type === 'transfer' ? null : categoryId,
        note,
      });
      return true;
    });
    if (ok) router.back();
  };

  const remove = async () => {
    if (!(await confirm('Delete this transaction?', 'Balances will update. This cannot be undone.'))) return;
    await run(() => deleteTransaction(db, tx.id));
    router.back();
  };

  return (
    <FormScreen
      title="Edit transaction"
      footer={
        <>
          <Button label="Save changes" onPress={save} />
          <Button label="Delete" kind="danger" onPress={remove} />
        </>
      }
    >
      {tx.goalId ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>This is the purchase of a goal. Deleting it makes the goal active again.</Text>
      ) : null}
      <OptionChips
        label="Type"
        options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfer' }] as { value: TxType; label: string }[]}
        value={type}
        onChange={(t) => { setType(t); setCategoryId(null); }}
      />
      <MoneyField label="Amount" value={amount} onChangeText={setAmount} />
      <DateField value={date} onChange={setDate} today={today} />
      <OptionChips label={type === 'transfer' ? 'From' : 'Account'} options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
      {type === 'transfer' ? (
        <OptionChips label="To" options={accounts.filter((a) => a.id !== accountId).map((a) => ({ value: a.id, label: a.name }))} value={toAccountId} onChange={setToAccountId} />
      ) : (
        <OptionChips label="Category" options={categoryOptions} value={categoryId} onChange={setCategoryId} hint="Optional" />
      )}
      <TextField label="Note" value={note} onChangeText={setNote} maxLength={200} placeholder="Optional" />
    </FormScreen>
  );
}
