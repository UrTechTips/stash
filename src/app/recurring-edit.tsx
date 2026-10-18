import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { confirm, useAction } from '../app-state/actions';
import { useApp, useQuery } from '../app-state/AppProvider';
import { Button, DateField, FormScreen, MoneyField, OptionChips, TextField } from '../components';
import { listAccounts } from '../db/accounts';
import { listCategories } from '../db/categories';
import { createRule, deleteRule, listRules, updateRule } from '../db/recurring';
import type { Cadence } from '../db/types';
import { minorToInput, parseToMinor } from '../lib/money';

export default function RecurringEdit() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const { db, today } = useApp();
  const run = useAction();
  const { data } = useQuery(async (d) => ({
    accounts: await listAccounts(d),
    categories: await listCategories(d),
    rule: id ? (await listRules(d)).find((r) => r.id === Number(id)) ?? null : null,
  }), [id]);

  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [nextDue, setNextDue] = useState(today);
  const [loaded, setLoaded] = useState(false);

  // Fill the form once when the saved data arrives.
  if (data && !loaded) {
  if (data.rule) {
    const r = data.rule;
    setType(r.type);
    setAmount(minorToInput(r.amount));
    setAccountId(r.accountId);
    setCategoryId(r.categoryId);
    setNote(r.note);
    setCadence(r.cadence);
    setNextDue(r.nextDue);
  } else {
    setAccountId(data.accounts[0]?.id ?? null);
  }
  setLoaded(true);
  }

  if (!data) return <FormScreen title="Repeating item"><></></FormScreen>;

  const save = async () => {
    const input = { type, amount: parseToMinor(amount) ?? 0, accountId: accountId ?? 0, categoryId, note, cadence, startDate: nextDue };
    const ok = await run(async () => {
      if (id) await updateRule(db, Number(id), input);
      else await createRule(db, input);
      return true;
    });
    if (ok) router.back();
  };

  const remove = async () => {
    if (!(await confirm('Delete this?', 'Transactions it already created stay in your history.'))) return;
    await run(() => deleteRule(db, Number(id)));
    router.back();
  };

  return (
    <FormScreen
      title={id ? 'Edit repeating item' : 'Add a repeating item'}
      footer={
        <>
          <Button label={id ? 'Save changes' : 'Add'} onPress={save} disabled={!(parseToMinor(amount) ?? 0) || accountId === null} />
          {id ? <Button label="Delete" kind="danger" onPress={remove} /> : null}
        </>
      }
    >
      <OptionChips options={[{ value: 'expense', label: 'Bill or expense' }, { value: 'income', label: 'Income' }] as { value: 'expense' | 'income'; label: string }[]} value={type} onChange={(t) => { setType(t); setCategoryId(null); }} />
      <TextField label="Name" value={note} onChangeText={setNote} maxLength={60} placeholder="Rent, Netflix, Stipend" />
      <MoneyField label="Amount" value={amount} onChangeText={setAmount} />
      <OptionChips
        label="How often"
        options={[{ value: 'weekly', label: 'Weekly' }, { value: 'monthly', label: 'Monthly' }, { value: 'yearly', label: 'Yearly' }] as { value: Cadence; label: string }[]}
        value={cadence}
        onChange={setCadence}
      />
      <DateField label="Next due" value={nextDue} onChange={setNextDue} today={today} allowFuture />
      <OptionChips label="Account" options={data.accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
      <OptionChips
        label="Category"
        options={data.categories.filter((c) => (type === 'income' ? c.kind === 'income' : c.kind !== 'income')).map((c) => ({ value: c.id, label: c.name, emoji: c.icon }))}
        value={categoryId}
        onChange={setCategoryId}
        hint="Optional. A due date in the past creates the missed transactions the next time you open the app."
      />
    </FormScreen>
  );
}
