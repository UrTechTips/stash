import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { confirm, useAction } from '../../app-state/actions';
import { useApp, useQuery } from '../../app-state/AppProvider';
import { Button, FormScreen, MoneyField, OptionChips, TextField, ToggleRow } from '../../components';
import { createAccount, defaultSpendable, getAccount, setAccountArchived, updateAccount } from '../../db/accounts';
import { ACCOUNT_TYPES, type AccountType } from '../../db/types';
import { formatMoney, minorToInput, parseToMinor } from '../../lib/money';
import { useTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

/** Create (id = "new") or edit an account. */
export default function AccountForm() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const { db } = useApp();
  const { colors } = useTheme();
  const run = useAction();
  const { data: account } = useQuery((d) => (isNew ? Promise.resolve(null) : getAccount(d, Number(id))), [id]);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('bank');
  const [opening, setOpening] = useState('');
  const [spendable, setSpendable] = useState(true);
  const [loaded, setLoaded] = useState(false);

  // Fill the form once when the saved data arrives (setting state while rendering is the supported way to do this).
  if (account && !loaded) {
    setName(account.name);
    setType(account.type);
    // a credit card's opening balance is stored negative (money owed) but typed as a positive amount
    setOpening(minorToInput(account.type === 'credit' ? -account.openingBalance : account.openingBalance));
    setSpendable(account.isSpendable);
    setLoaded(true);
  }

  const owed = type === 'credit';
  const save = async () => {
    const typed = parseToMinor(opening) ?? 0;
    const input = { name, type, openingBalance: owed ? -typed : typed, isSpendable: spendable };
    const ok = await run(async () => {
      if (isNew) await createAccount(db, input);
      else await updateAccount(db, Number(id), input);
      return true;
    });
    if (ok) router.back();
  };

  const archive = async () => {
    if (!account) return;
    const next = !account.archived;
    if (next && !(await confirm('Archive this account?', 'It disappears from lists and totals. Its history stays.', 'Archive', false))) return;
    await run(() => setAccountArchived(db, account.id, next));
    router.back();
  };

  return (
    <FormScreen
      title={isNew ? 'Add account' : 'Edit account'}
      footer={
        <>
          <Button label={isNew ? 'Add account' : 'Save changes'} onPress={save} disabled={name.trim().length === 0} />
          {!isNew && account ? <Button label={account.archived ? 'Restore account' : 'Archive account'} kind="secondary" onPress={archive} /> : null}
        </>
      }
    >
      {!isNew && account ? (
        <Text style={[typography.body, { color: colors.textSecondary }]}>Current balance {formatMoney(account.balance)}</Text>
      ) : null}
      <TextField label="Name" value={name} onChangeText={setName} maxLength={40} placeholder="For example: HDFC, Cash, UPI" />
      <OptionChips
        label="Type"
        options={ACCOUNT_TYPES.map((t) => ({ value: t.value, label: t.label, emoji: t.emoji }))}
        value={type}
        onChange={(t) => {
          setType(t);
          if (isNew) setSpendable(defaultSpendable(t));
        }}
      />
      <MoneyField
        label={owed ? 'Amount you owe right now' : 'Balance when you started tracking'}
        value={opening}
        onChangeText={setOpening}
        hint="Every transaction after this moves the balance. Changing it later shifts the whole history."
      />
      <ToggleRow
        label="Counts as spendable"
        hint="Spendable accounts make up your liquid money. Turn this off for a locked fixed deposit."
        value={spendable}
        onValueChange={setSpendable}
      />
    </FormScreen>
  );
}
