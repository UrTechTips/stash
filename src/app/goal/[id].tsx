import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirm, useAction } from '../../app-state/actions';
import { useApp, useQuery } from '../../app-state/AppProvider';
import { AmountText, Button, Card, DateField, GoalCard, MoneyField, OptionChips, Screen, ScreenHeader, Stepper } from '../../components';
import { listAccounts } from '../../db/accounts';
import { listCategories } from '../../db/categories';
import { earmarkedByAccount } from '../../db/earmarks';
import { allocateToGoal, deleteGoal, dropGoal, getGoal, goalAllocations, markGoalBought, reactivateGoal } from '../../db/goals';
import { shortDate } from '../../engine/dates';
import { formatMoney, minorToInput, parseToMinor } from '../../lib/money';
import { loadContext } from '../../services/context';
import { verdictFor, whatIf } from '../../services/goals';
import { checksToUi, headlineFor } from '../../services/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

type Panel = 'allocate' | 'release' | 'buy' | null;

export default function GoalDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { db, today } = useApp();
  const { colors } = useTheme();
  const run = useAction();
  const [panel, setPanel] = useState<Panel>(null);
  const [amount, setAmount] = useState('');
  const [accountId, setAccountId] = useState<number | null>(null);
  const [date, setDate] = useState(today);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [extra, setExtra] = useState(0);

  const { data } = useQuery(async (d, t) => {
    const goal = await getGoal(d, Number(id));
    if (!goal) return null;
    const ctx = await loadContext(d, t);
    return {
      goal,
      ctx,
      verdict: goal.status === 'active' ? verdictFor(ctx, goal) : null,
      allocations: await goalAllocations(d, goal.id),
      earmarked: await earmarkedByAccount(d),
      accounts: await listAccounts(d),
      categories: (await listCategories(d)).filter((c) => c.kind !== 'income'),
    };
  }, [id]);

  if (data === undefined) return <Screen><ScreenHeader title="Goal" /></Screen>;
  if (data === null) {
    return (
      <Screen>
        <ScreenHeader title="Goal" />
        <Text style={[typography.body, styles.pad, { color: colors.textSecondary }]}>This goal no longer exists.</Text>
      </Screen>
    );
  }

  const { goal, ctx, verdict, allocations, earmarked, accounts } = data;
  const heldOn = (accId: number) => allocations.find((a) => a.accountId === accId)?.amount ?? 0;
  const freeOn = (accId: number, balance: number) => Math.max(0, balance - (earmarked[accId] ?? 0));
  const projected = verdict && extra > 0 ? whatIf(ctx, goal, extra) : null;

  const open = (p: Panel) => {
    setPanel(panel === p ? null : p);
    setAmount('');
    if (p === 'buy') setAmount(minorToInput(goal.price));
    if (p === 'allocate') setAccountId(accounts.find((a) => a.isSpendable && freeOn(a.id, a.balance) > 0)?.id ?? null);
    if (p === 'release') setAccountId(allocations[0]?.accountId ?? null);
    if (p === 'buy') setAccountId(accounts.find((a) => a.isSpendable)?.id ?? accounts[0]?.id ?? null);
  };

  const submit = async () => {
    const minor = parseToMinor(amount) ?? 0;
    const ok = await run(async () => {
      if (accountId === null) throw new Error('Pick an account.');
      if (panel === 'allocate') await allocateToGoal(db, goal.id, accountId, minor, today);
      else if (panel === 'release') await allocateToGoal(db, goal.id, accountId, -minor, today);
      else if (panel === 'buy') await markGoalBought(db, goal.id, { accountId, amount: minor, date, categoryId });
      return true;
    });
    if (ok) {
      const bought = panel === 'buy';
      setPanel(null);
      setAmount('');
      if (bought) router.back();
    }
  };

  const drop = async () => {
    if (!(await confirm('Stop saving for this?', 'Its set-aside money goes back to being free. You can bring the goal back later.', 'Stop saving', false))) return;
    await run(() => dropGoal(db, goal.id));
  };
  const remove = async () => {
    if (!(await confirm('Delete this goal?', 'This removes the goal and its set-aside history. A recorded purchase stays in your transactions.'))) return;
    await run(() => deleteGoal(db, goal.id));
    router.back();
  };

  return (
    <Screen>
      <ScreenHeader
        title={goal.name}
        right={
          <Pressable onPress={() => router.push({ pathname: '/goal/edit', params: { id: String(goal.id) } })} accessibilityRole="button" accessibilityLabel="Edit goal" style={styles.iconButton}>
            <Ionicons name="create-outline" size={24} color={colors.textPrimary} />
          </Pressable>
        }
      />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {verdict ? (
          <GoalCard
            name={goal.name}
            emoji={goal.type === 'gift' ? '🎁' : goal.type === 'need' ? '🧰' : '🎯'}
            priceMinor={goal.price}
            savedMinor={goal.saved}
            status={verdict.status}
            headline={headlineFor(verdict, ctx.today)}
            checks={checksToUi(verdict.checks)}
          />
        ) : (
          <Card>
            <Text style={[typography.headline, { color: colors.textPrimary }]}>{goal.status === 'bought' ? 'Bought' : 'Stopped saving'}</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {goal.status === 'bought' ? `You bought this for ${formatMoney(goal.price)} or thereabouts. The purchase is in your transactions.` : 'This goal is not holding any money.'}
            </Text>
            {goal.status === 'dropped' ? <Button label="Bring it back" kind="secondary" onPress={() => run(() => reactivateGoal(db, goal.id))} /> : null}
          </Card>
        )}

        {verdict ? (
          <>
            <Card>
              <Text style={[typography.title, { color: colors.textPrimary }]}>The numbers</Text>
              <Line label="Price" minor={goal.price} />
              <Line label="Set aside for it" minor={goal.saved} />
              <Line label="Liquid money" minor={ctx.liquid} />
              <Line label={`Safety buffer (${ctx.engine.bufferMonths} ${ctx.engine.bufferMonths === 1 ? 'month' : 'months'} of essentials)`} minor={verdict.buffer} />
              <Line label="Bills before your next income" minor={ctx.snapshot.upcomingObligations} />
              <Line label="Reserved for higher-priority goals" minor={verdict.floor - verdict.buffer - ctx.snapshot.upcomingObligations} />
              <Line label={`Funds you need (${verdict.multiple}x the price on top)`} minor={verdict.required} />
              <Line label="Still needed" minor={verdict.shortfall} strong />
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                {verdict.tier[0].toUpperCase() + verdict.tier.slice(1)} purchase · cooling-off {verdict.coolingOffDays === 0 ? 'not needed' : `${verdict.coolingOffDays} days`}
                {verdict.etaDate ? ` · estimated date ${shortDate(verdict.etaDate, ctx.today)}` : ''}
              </Text>
              {verdict.costPerUse !== undefined || verdict.workHours !== undefined || verdict.suggestedMonthly !== undefined ? (
                <View style={{ gap: 4 }}>
                  {verdict.costPerUse !== undefined ? <Text style={[typography.body, { color: colors.textPrimary }]}>Cost per use: {formatMoney(verdict.costPerUse)}</Text> : null}
                  {verdict.workHours !== undefined ? <Text style={[typography.body, { color: colors.textPrimary }]}>About {verdict.workHours} hours of your work</Text> : null}
                  {verdict.suggestedMonthly !== undefined ? <Text style={[typography.body, { color: colors.textPrimary }]}>To make your date, set aside {formatMoney(verdict.suggestedMonthly)} a month</Text> : null}
                </View>
              ) : null}
            </Card>

            {verdict.shortfall > 0 ? (
              <Card>
                <Text style={[typography.title, { color: colors.textPrimary }]}>What if I save more?</Text>
                <Stepper label="Extra per month" value={extra} onChange={setExtra} step={50_000} min={0} max={50_000_000} format={(n) => formatMoney(n)} />
                <Text style={[typography.body, { color: colors.textPrimary }]}>
                  {extra === 0
                    ? 'Move the amount to see the date change.'
                    : projected?.etaDate
                      ? `Safe around ${shortDate(projected.etaDate, ctx.today)}${verdict.etaDate ? ` instead of ${shortDate(verdict.etaDate, ctx.today)}` : ''}.`
                      : 'Still no date: your saving rate would not be positive.'}
                </Text>
              </Card>
            ) : null}

            <Card>
              <Text style={[typography.title, { color: colors.textPrimary }]}>Where the money is</Text>
              {allocations.length === 0 ? (
                <Text style={[typography.body, { color: colors.textSecondary }]}>Nothing set aside yet. Setting money aside does not move it: it stays in your account, and Stash keeps it out of your spendable total for this goal.</Text>
              ) : (
                allocations.map((a) => (
                  <View key={a.accountId} style={styles.line}>
                    <Text style={[typography.body, { color: colors.textPrimary, flex: 1 }]}>{a.accountName}</Text>
                    <AmountText minor={a.amount} />
                  </View>
                ))
              )}
              <View style={styles.actions}>
                <Button label="Set money aside" kind="secondary" onPress={() => open('allocate')} style={styles.flex} />
                <Button label="Take money back" kind="secondary" onPress={() => open('release')} disabled={allocations.length === 0} style={styles.flex} />
              </View>
            </Card>

            {panel === 'allocate' || panel === 'release' ? (
              <Card>
                <Text style={[typography.title, { color: colors.textPrimary }]}>{panel === 'allocate' ? 'Set money aside' : 'Take money back'}</Text>
                <OptionChips
                  label="Account"
                  options={(panel === 'allocate' ? accounts.filter((a) => a.isSpendable) : accounts.filter((a) => heldOn(a.id) > 0)).map((a) => ({
                    value: a.id,
                    label: panel === 'allocate' ? `${a.name} · ${formatMoney(freeOn(a.id, a.balance))} free` : `${a.name} · ${formatMoney(heldOn(a.id))} held`,
                  }))}
                  value={accountId}
                  onChange={setAccountId}
                />
                <MoneyField label="Amount" value={amount} onChangeText={setAmount} />
                <Button label={panel === 'allocate' ? 'Set aside' : 'Take back'} onPress={submit} />
              </Card>
            ) : null}

            <Button label="I bought it" onPress={() => open('buy')} />
            {panel === 'buy' ? (
              <Card>
                <Text style={[typography.title, { color: colors.textPrimary }]}>Record the purchase</Text>
                <MoneyField label="What you paid" value={amount} onChangeText={setAmount} />
                <OptionChips label="Paid from" options={accounts.map((a) => ({ value: a.id, label: a.name }))} value={accountId} onChange={setAccountId} />
                <OptionChips label="Category" options={data.categories.map((c) => ({ value: c.id, label: c.name, emoji: c.icon }))} value={categoryId} onChange={setCategoryId} hint="Optional" />
                <DateField value={date} onChange={setDate} today={today} />
                <Button label="Save purchase" onPress={submit} />
              </Card>
            ) : null}
          </>
        ) : null}

        {goal.url ? <Button label="Open link" kind="ghost" onPress={() => Linking.openURL(goal.url!).catch(() => undefined)} /> : null}
        {goal.status === 'active' ? <Button label="Stop saving for this" kind="secondary" onPress={drop} /> : null}
        <Button label="Delete goal" kind="danger" onPress={remove} />
      </ScrollView>
    </Screen>
  );
}

function Line({ label, minor, strong }: { label: string; minor: number; strong?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.line}>
      <Text style={[strong ? typography.titleSmall : typography.body, { color: strong ? colors.textPrimary : colors.textSecondary, flex: 1 }]}>{label}</Text>
      <AmountText minor={minor} style={strong ? typography.amountRow : typography.amountSmall} />
    </View>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: 20 },
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  actions: { flexDirection: 'row', gap: 12 },
  flex: { flex: 1 },
});
