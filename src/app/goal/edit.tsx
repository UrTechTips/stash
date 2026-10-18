import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { useAction } from '../../app-state/actions';
import { useApp, useQuery } from '../../app-state/AppProvider';
import { Button, DateField, FormScreen, MoneyField, OptionChips, TextField, ToggleRow } from '../../components';
import { createGoal, getGoal, updateGoal } from '../../db/goals';
import { addDays } from '../../engine/dates';
import { minorToInput, parseToMinor } from '../../lib/money';

/** Add a goal, or edit one (when an id is given). */
export default function GoalForm() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const router = useRouter();
  const { db, today } = useApp();
  const run = useAction();
  const { data: goal } = useQuery((d) => (id ? getGoal(d, Number(id)) : Promise.resolve(null)), [id]);

  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState<'want' | 'need' | 'gift'>('want');
  const [priority, setPriority] = useState(2);
  const [hasDate, setHasDate] = useState(false);
  const [targetDate, setTargetDate] = useState(addDays(today, 30));
  const [url, setUrl] = useState('');
  const [uses, setUses] = useState('');
  const [plan, setPlan] = useState('');
  const [loaded, setLoaded] = useState(false);

  // Fill the form once when the saved data arrives (setting state while rendering is the supported way to do this).
  if (goal && !loaded) {
    setName(goal.name);
    setPrice(minorToInput(goal.price));
    setType(goal.type);
    setPriority(goal.priority);
    setHasDate(!!goal.targetDate);
    if (goal.targetDate) setTargetDate(goal.targetDate);
    setUrl(goal.url ?? '');
    setUses(goal.expectedUses ? String(goal.expectedUses) : '');
    setPlan(goal.monthlyPlan ? minorToInput(goal.monthlyPlan) : '');
    setLoaded(true);
  }

  const save = async () => {
    const input = {
      name,
      price: parseToMinor(price) ?? 0,
      type,
      priority,
      targetDate: hasDate ? targetDate : null,
      url,
      expectedUses: uses.trim() ? Number(uses) : null,
      monthlyPlan: parseToMinor(plan) ?? 0,
    };
    const ok = await run(async () => {
      if (editing) await updateGoal(db, Number(id), input);
      else await createGoal(db, input, today);
      return true;
    });
    if (ok) router.back();
  };

  return (
    <FormScreen
      title={editing ? 'Edit goal' : 'Add a goal'}
      footer={<Button label={editing ? 'Save changes' : 'Add to wishlist'} onPress={save} disabled={name.trim().length === 0 || !(parseToMinor(price) ?? 0)} />}
    >
      <TextField label="What do you want?" value={name} onChangeText={setName} maxLength={60} placeholder="For example: Mechanical keyboard" />
      <MoneyField label="Price" value={price} onChangeText={setPrice} />
      <OptionChips
        label="Kind"
        options={[
          { value: 'want', label: 'Want', emoji: '🎯' },
          { value: 'need', label: 'Need', emoji: '🧰' },
          { value: 'gift', label: 'Gift', emoji: '🎁' },
        ]}
        value={type}
        onChange={setType}
        hint={
          type === 'need'
            ? 'Needs skip the cooling-off wait and only ask for the price on top of your safety floor.'
            : type === 'gift'
              ? 'A gift with a fixed date skips the cooling-off wait. Safety checks still apply.'
              : 'Wants wait out a cooling-off period and keep a bigger cushion, bigger for pricier things.'
        }
      />
      <OptionChips
        label="Priority"
        options={[{ value: 1, label: 'High' }, { value: 2, label: 'Medium' }, { value: 3, label: 'Low' }]}
        value={priority}
        onChange={setPriority}
        hint="When two goals want the same money, the higher priority reserves it first."
      />
      <ToggleRow label="I need it by a date" value={hasDate} onValueChange={setHasDate} />
      {hasDate ? <DateField label="Target date" value={targetDate} onChange={setTargetDate} today={today} allowFuture /> : null}
      <MoneyField label="Plan to set aside each month (optional)" value={plan} onChangeText={setPlan} hint="Counted against your daily spending number until you set the money aside." />
      <TextField label="Expected uses (optional)" value={uses} onChangeText={(t) => setUses(t.replace(/[^\d]/g, ''))} keyboardType="number-pad" hint="Shows cost per use, for example 300 hours of typing." />
      <TextField label="Link (optional)" value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" placeholder="https://" />
    </FormScreen>
  );
}
