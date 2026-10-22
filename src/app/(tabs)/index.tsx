import { loadSettings } from '@/db/settings';
import { useHaptics } from '@/hooks/useHaptics';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '../../app-state/AppProvider';
import {
  AmountText,
  BudgetRow,
  CategoryBadge,
  DayHeader,
  EmptyState,
  GoalCard,
  SafeToSpendHero,
  Screen,
  SectionHeader,
  TransactionRow,
  txRowProps,
  useFloatingBarSpace,
} from '../../components';
import { Button, Card } from '../../components/forms';
import { listTransactions } from '../../db/transactions';
import { dayLabel, monthLabel } from '../../engine/dates';
import { loadContext } from '../../services/context';
import { evaluateAll, topGoal } from '../../services/goals';
import { checksToUi, headlineFor } from '../../services/ui';
import { useTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

export default function Home() {
  const router = useRouter();
  const haptics = useHaptics();
  const { colors } = useTheme();
  const barSpace = useFloatingBarSpace();
  const { data } = useQuery(async (db, today) => {
    const ctx = await loadContext(db, today);
    const goal = topGoal(evaluateAll(ctx));
    const recent = await listTransactions(db, { limit: 6 });
    return { ctx, goal, recent };
  });

  const { data: s } = useQuery((db) => loadSettings(db));

  if (!data) return <Screen><View /></Screen>;
  const { ctx, goal, recent } = data;
  const a = ctx.allowance;

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: barSpace + 80 }}>
        <View style={styles.topRow}>
          <Text style={[typography.headline, { color: colors.textPrimary }]}>{monthLabel(ctx.month)}</Text>
          <View style={styles.topIcons}>
            <IconButton name="stats-chart" label="Insights" onPress={haptics(() => router.push('/insights'), "medium")} />
            <IconButton name="settings-outline" label="Settings" onPress={haptics(() => router.push('/settings'), "medium")} />
          </View>
        </View>

        {ctx.budget ? (
          <SafeToSpendHero
            remainingToday={a.remainingToday}
            allowanceToday={a.allowance}
            daysLeft={a.daysLeft}
            overBudgetBy={a.overBudgetBy}
            context={ctx}
            style={styles.hero}
            hidden={s?.hideTotalBalance}
          />
        ) : (
          <Card style={styles.hero}>
            <Text style={[typography.headline, { color: colors.textPrimary }]}>Set a monthly budget</Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              Stash turns it into what you can safely spend each day.
            </Text>
            <Button label="Set budget" onPress={() => router.push('/budget')} />
          </Card>
        )}

        {ctx.upcomingBills.length > 0 ? (
          <>
            <SectionHeader title="Coming up" actionLabel="Bills" onAction={haptics(() => router.push('/recurring'), "light")} />
            {ctx.upcomingBills.slice(0, 3).map((o) => (
              <View key={`${o.rule.id}-${o.date}`} style={styles.billRow}>
                <CategoryBadge emoji="🧾" tint="#2F7FD0" />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={[typography.titleSmall, { color: colors.textPrimary }]}>{o.rule.note || 'Bill'}</Text>
                  <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{dayLabel(o.date, ctx.today)}</Text>
                </View>
                <AmountText minor={o.rule.amount} />
              </View>
            ))}
          </>
        ) : null}

        {ctx.budget ? (
          <>
            <SectionHeader title="This month" actionLabel="Budget" onAction={haptics(() => router.push('/budget'), "light")} />
            <BudgetRow name="All spending" spentMinor={ctx.spentThisMonth} limitMinor={ctx.budgetTotal} paceFraction={a.paceFraction} />
          </>
        ) : null}

        <SectionHeader title="Next purchase" actionLabel="All goals" onAction={() => router.push('/goals')} />
        {goal ? (
          <View style={styles.pad}>
            <GoalCard
              name={goal.goal.name}
              emoji="🎯"
              priceMinor={goal.goal.price}
              savedMinor={goal.goal.saved}
              status={goal.verdict.status}
              headline={headlineFor(goal.verdict, ctx.today)}
              checks={checksToUi(goal.verdict.checks)}
              onPress={() => router.push({ pathname: '/goal/[id]', params: { id: String(goal.goal.id) } })}
            />
          </View>
        ) : (
          <EmptyState
            title="Nothing on your wishlist"
            body="Add something you want to buy. Stash tells you when it is safe."
            actionLabel="Add a goal"
            onAction={() => router.push('/goal/edit')}
          />
        )}

        {recent.length > 0 ? (
          <>
            <SectionHeader title="Recent" actionLabel="See all" onAction={haptics(() => router.push('/activity'), "light")} />
            {recent.map((t, i) => (
              <View key={t.id}>
                {i === 0 || recent[i - 1].date !== t.date ? <DayHeader label={dayLabel(t.date, ctx.today)} spentMinor={0} /> : null}
                <TransactionRow {...txRowProps(t)} onPress={haptics(() => router.push({ pathname: '/transaction/[id]', params: { id: String(t.id) } }), "light")} />
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function IconButton({ name, label, onPress }: { name: React.ComponentProps<typeof Ionicons>['name']; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} hitSlop={6} style={styles.iconButton}>
      <Ionicons name={name} size={24} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topRow: { paddingHorizontal: 20, paddingTop: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 56 },
  topIcons: { flexDirection: 'row' },
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  hero: { marginHorizontal: 20, marginVertical: 8 },
  moneyRow: { flexDirection: 'row', paddingHorizontal: 20, paddingVertical: 8, gap: 24 },
  stat: { flex: 1, gap: 2 },
  pad: { paddingHorizontal: 20 },
  billRow: { minHeight: 60, paddingHorizontal: 20, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 14 },
});
