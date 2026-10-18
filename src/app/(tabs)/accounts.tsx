import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '../../app-state/AppProvider';
import { openQuickAdd } from '../../app-state/quickAdd';
import { AccountRow, AmountText, EmptyState, Screen, SectionHeader, useFloatingBarSpace } from '../../components';
import { Button } from '../../components/forms';
import { listAccounts, summarizeAccounts } from '../../db/accounts';
import { ACCOUNT_TYPES } from '../../db/types';
import { useTheme } from '../../theme/ThemeProvider';
import { typography } from '../../theme/typography';

const TINTS = ['#2F7FD0', '#17A06A', '#E08A1E', '#6C4FD8', '#C03F2B', '#8A6D3B'];

export default function Accounts() {
  const router = useRouter();
  const { colors } = useTheme();
  const space = useFloatingBarSpace();
  const [showArchived, setShowArchived] = useState(false);
  const { data: all } = useQuery((db) => listAccounts(db, { includeArchived: true }));
  if (!all) return <Screen><View /></Screen>;

  const active = all.filter((a) => !a.archived);
  const archived = all.filter((a) => a.archived);
  const { netWorth, liquid } = summarizeAccounts(all);
  const open = (id: string) => router.push({ pathname: '/account/[id]', params: { id } });

  const row = (a: (typeof all)[number], i: number) => {
    const t = ACCOUNT_TYPES.find((x) => x.value === a.type)!;
    return (
      <AccountRow
        key={a.id}
        name={a.name}
        typeLabel={t.label}
        balanceMinor={a.balance}
        spendable={a.isSpendable}
        emoji={t.emoji}
        tint={TINTS[i % TINTS.length]}
        onPress={() => open(String(a.id))}
      />
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: space + 80 }}>
        <View style={styles.summary}>
          <Text style={[typography.headline, { color: colors.textPrimary }]}>Accounts</Text>
          <Text style={[typography.body, { color: colors.textSecondary }]}>Net worth</Text>
          <AmountText minor={netWorth} style={typography.headlineLarge} />
          <Text style={[typography.body, { color: colors.textSecondary }]}>
            Liquid money <AmountText minor={liquid} style={typography.amountRow} />
          </Text>
        </View>
        <View style={styles.actions}>
          <Button label="Add account" kind="secondary" onPress={() => open('new')} style={styles.flex} />
          <Button label="Transfer" kind="secondary" onPress={() => openQuickAdd('transfer')} disabled={active.length < 2} style={styles.flex} />
        </View>

        {active.length === 0 ? (
          <EmptyState title="No accounts yet" body="Add the places your money lives: bank, UPI, cash." actionLabel="Add account" onAction={() => open('new')} />
        ) : (
          active.map(row)
        )}

        {archived.length > 0 ? (
          <>
            <SectionHeader title={`Archived (${archived.length})`} actionLabel={showArchived ? 'Hide' : 'Show'} onAction={() => setShowArchived((s) => !s)} />
            {showArchived ? archived.map(row) : null}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  summary: { paddingHorizontal: 20, paddingTop: 12, gap: 2 },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingVertical: 16 },
  flex: { flex: 1 },
});
