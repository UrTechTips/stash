import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useQuery } from '../../app-state/AppProvider';
import { AmountText, ChoiceChip, DayHeader, EmptyState, Screen, TransactionRow, txRowProps, useFloatingBarSpace } from '../../components';
import { listTransactions } from '../../db/transactions';
import type { TransactionRow as Tx, TxType } from '../../db/types';
import { addDays, dayLabel, startOfMonth } from '../../engine/dates';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, typography } from '../../theme/typography';

const PAGE = 100;
type Range = 'all' | 'month' | '30d';
type Item = { kind: 'header'; key: string; label: string; spent: number } | { kind: 'tx'; key: string; tx: Tx };

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Every transaction, newest first, with search and filters. Loads more as you scroll. */
export default function Activity() {
  const router = useRouter();
  const { colors } = useTheme();
  const space = useFloatingBarSpace();
  const [search, setSearch] = useState('');
  const [type, setType] = useState<TxType | 'all'>('all');
  const [range, setRange] = useState<Range>('all');
  const query = useDebounced(search);
  // The page size belongs to one set of filters; changing a filter starts again from the first page.
  const filterKey = `${query}|${type}|${range}`;
  const [paging, setPaging] = useState({ key: filterKey, limit: PAGE });
  const limit = paging.key === filterKey ? paging.limit : PAGE;

  const { data, loading } = useQuery(
    (db, today) =>
      listTransactions(db, {
        search: query,
        type: type === 'all' ? undefined : type,
        from: range === 'month' ? startOfMonth(today) : range === '30d' ? addDays(today, -30) : undefined,
        limit,
      }),
    [query, type, range, limit],
  );
  const { data: today } = useQuery(async (_db, t) => t);

  const items = useMemo<Item[]>(() => {
    if (!data || !today) return [];
    const out: Item[] = [];
    for (let i = 0; i < data.length; i++) {
      const t = data[i];
      if (i === 0 || data[i - 1].date !== t.date) {
        const spent = data.filter((x) => x.date === t.date && x.type === 'expense').reduce((s, x) => s + x.amount, 0);
        out.push({ kind: 'header', key: `h-${t.date}`, label: dayLabel(t.date, today), spent });
      }
      out.push({ kind: 'tx', key: `t-${t.id}`, tx: t });
    }
    return out;
  }, [data, today]);

  return (
    <Screen>
      <View style={styles.top}>
        <Text style={[typography.headline, { color: colors.textPrimary }]}>Activity</Text>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search notes, categories, accounts"
          placeholderTextColor={colors.textSecondary}
          accessibilityLabel="Search transactions"
          returnKeyType="search"
          style={[styles.search, { color: colors.textPrimary, borderColor: colors.outline, backgroundColor: colors.surface, fontFamily: fonts.body }]}
        />
        <View style={styles.chips}>
          {(['all', 'expense', 'income', 'transfer'] as const).map((t) => (
            <ChoiceChip key={t} label={t === 'all' ? 'All' : t[0].toUpperCase() + t.slice(1)} selected={type === t} onPress={() => setType(t)} />
          ))}
        </View>
        <View style={styles.chips}>
          {([['all', 'All time'], ['month', 'This month'], ['30d', 'Last 30 days']] as const).map(([r, label]) => (
            <ChoiceChip key={r} label={label} selected={range === r} onPress={() => setRange(r)} />
          ))}
        </View>
      </View>

      <FlatList
        data={items}
        keyExtractor={(i) => i.key}
        contentContainerStyle={{ paddingBottom: space + 24 }}
        keyboardShouldPersistTaps="handled"
        onEndReached={() => data && data.length >= limit && setPaging({ key: filterKey, limit: limit + PAGE })}
        onEndReachedThreshold={0.6}
        renderItem={({ item }) =>
          item.kind === 'header' ? (
            <DayHeader label={item.label} spentMinor={item.spent} />
          ) : (
            <TransactionRow {...txRowProps(item.tx)} onPress={() => router.push({ pathname: '/transaction/[id]', params: { id: String(item.tx.id) } })} />
          )
        }
        ListEmptyComponent={
          loading ? null : (
            <EmptyState
              title={query || type !== 'all' || range !== 'all' ? 'Nothing matches' : 'No transactions yet'}
              body={query || type !== 'all' || range !== 'all' ? 'Try a different search or filter.' : 'Tap Add to log your first expense.'}
            />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 12, gap: 10, paddingBottom: 6 },
  search: { minHeight: 48, borderWidth: 1, borderRadius: 18, paddingHorizontal: 16, fontSize: 15 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
