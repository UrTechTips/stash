import React, { useState } from 'react';
import { Text } from 'react-native';
import { useAction } from '../app-state/actions';
import { useApp } from '../app-state/AppProvider';
import { Button, FormScreen, MoneyField, OptionChips, TextField } from '../components';
import { createAccount } from '../db/accounts';
import { setBudget } from '../db/budgets';
import { saveSettings } from '../db/settings';
import { ACCOUNT_TYPES, type AccountType } from '../db/types';
import { monthOf } from '../engine/dates';
import { parseToMinor, setCurrency } from '../lib/money';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

const CURRENCIES = [
  { value: '₹', label: '₹ Rupee' },
  { value: '$', label: '$ Dollar' },
  { value: '€', label: '€ Euro' },
  { value: '£', label: '£ Pound' },
];

/** First run: one account, a rough income and a monthly budget. Everything here can be changed later. */
export default function Onboarding() {
  const { db, today } = useApp();
  const { colors } = useTheme();
  const run = useAction();
  const [currency, setCurrencyState] = useState('₹');
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [balance, setBalance] = useState('');
  const [income, setIncome] = useState('');
  const [budget, setBudgetText] = useState('');
  const [essentials, setEssentials] = useState('');
  const [saving, setSaving] = useState(false);

  const canStart = name.trim().length > 0 && !saving;

  const start = async () => {
    setSaving(true);
    const incomeMinor = parseToMinor(income) ?? 0;
    const budgetMinor = parseToMinor(budget) ?? 0;
    const format = { symbol: currency, indianGrouping: currency === '₹', minorDigits: 2 };
    const ok = await run(async () => {
      await db.transaction(async (tx) => {
        await createAccount(tx, { name, type, openingBalance: parseToMinor(balance) ?? 0 });
        if (budgetMinor > 0) await setBudget(tx, monthOf(today), { total: budgetMinor, carryOver: false, limits: {} });
        await saveSettings(tx, {
          currencySymbol: format.symbol,
          indianGrouping: format.indianGrouping,
          incomeEstimate: incomeMinor,
          essentialsEstimate: parseToMinor(essentials) ?? 0,
          // a starting guess for how much you save: income that is not budgeted
          savingRateEstimate: Math.max(0, incomeMinor - budgetMinor),
          onboarded: true,
        });
      });
      setCurrency(format);
      return true;
    });
    if (!ok) setSaving(false);
  };

  return (
    <FormScreen
      title="Welcome to Stash"
      footer={<Button label="Start using Stash" onPress={start} disabled={!canStart} />}
    >
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        Four quick answers set up your daily spending number. Rough guesses are fine; you can change everything later.
      </Text>
      <OptionChips label="Currency" options={CURRENCIES} value={currency} onChange={(v) => { setCurrencyState(v); setCurrency({ symbol: v, indianGrouping: v === '₹', minorDigits: 2 }); }} />
      <TextField label="Your first account" value={name} onChangeText={setName} placeholder="For example: HDFC, Cash, UPI" maxLength={40} />
      <OptionChips options={ACCOUNT_TYPES.filter((t) => t.value !== 'credit').map((t) => ({ value: t.value, label: t.label, emoji: t.emoji }))} value={type} onChange={setType} />
      <MoneyField label="How much is in it right now?" value={balance} onChangeText={setBalance} />
      <MoneyField label="About how much do you earn each month?" value={income} onChangeText={setIncome} hint="Used to size the price tiers for wishlist items." />
      <MoneyField label="Monthly budget" value={budget} onChangeText={setBudgetText} hint="What you want to spend this month, bills included. Your daily number comes from this." />
      <MoneyField label="Essentials per month (optional)" value={essentials} onChangeText={setEssentials} hint="Rent, groceries, transport, bills. It sets your safety buffer until Stash has a few months of history." />
    </FormScreen>
  );
}
