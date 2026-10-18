import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useAction } from '../app-state/actions';
import { useApp, useQuery } from '../app-state/AppProvider';
import { AmountText, EmptyState, Screen, ScreenHeader } from '../components';
import { listAccounts } from '../db/accounts';
import { listRules, setRuleActive } from '../db/recurring';
import { dayLabel } from '../engine/dates';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

const CADENCE = { weekly: 'Every week', monthly: 'Every month', yearly: 'Every year' } as const;

/** Rent, subscriptions, salary: things that repeat. Stash creates them as real transactions on the due date. */
export default function Recurring() {
  const router = useRouter();
  const { db } = useApp();
  const { colors } = useTheme();
  const run = useAction();
  const { data } = useQuery(async (d) => ({ rules: await listRules(d), accounts: await listAccounts(d, { includeArchived: true }) }));
  const { data: today } = useQuery(async (_d, t) => t);

  const add = (
    <Pressable onPress={() => router.push('/recurring-edit')} accessibilityRole="button" accessibilityLabel="Add a repeating item" style={styles.iconButton}>
      <Ionicons name="add-circle" size={32} color={colors.primary} />
    </Pressable>
  );

  return (
    <Screen>
      <ScreenHeader title="Bills and income" right={add} />
      {!data || !today ? null : data.rules.length === 0 ? (
        <EmptyState
          title="Nothing repeats yet"
          body="Add rent, subscriptions or your salary. Upcoming bills are set aside from your daily number, and Stash reminds you before they are due."
          actionLabel="Add one"
          onAction={() => router.push('/recurring-edit')}
        />
      ) : (
        <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
          {data.rules.map((r) => (
            <Pressable
              key={r.id}
              onPress={() => router.push({ pathname: '/recurring-edit', params: { id: String(r.id) } })}
              accessibilityRole="button"
              style={[styles.row, !r.active && { opacity: 0.5 }]}
            >
              <View style={{ flex: 1 }}>
                <Text numberOfLines={1} style={[typography.titleSmall, { color: colors.textPrimary }]}>{r.note || (r.type === 'income' ? 'Income' : 'Bill')}</Text>
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                  {CADENCE[r.cadence]} · next {dayLabel(r.nextDue, today)} · {data.accounts.find((a) => a.id === r.accountId)?.name ?? ''}
                </Text>
              </View>
              <AmountText minor={r.amount} kind={r.type} />
              <Switch
                value={r.active}
                onValueChange={(v) => run(() => setRuleActive(db, r.id, v))}
                accessibilityLabel={`${r.note || 'Rule'} active`}
                trackColor={{ false: colors.outline, true: colors.primary }}
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  iconButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  row: { minHeight: 68, paddingHorizontal: 20, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 12 },
});
