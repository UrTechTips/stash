import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useQuery } from '../app-state/AppProvider';
import { AmountText, CategoryBars, Card, EmptyState, MonthColumns, Screen, ScreenHeader } from '../components';
import { monthLabel } from '../engine/dates';
import { formatMoney } from '../lib/money';
import { loadInsights } from '../services/insights';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

export default function Insights() {
  const { colors } = useTheme();
  const { data } = useQuery((db, today) => loadInsights(db, today));
  if (!data) return <Screen><ScreenHeader title="Insights" /></Screen>;

  const hasAnything = data.months.some((m) => m.income > 0 || m.expense > 0);
  const lastByKey = Object.fromEntries(data.lastMonth.map((c) => [String(c.categoryId), c.total]));
  const thisMonth = data.months[data.months.length - 1].month;

  return (
    <Screen>
      <ScreenHeader title="Insights" />
      {!hasAnything ? (
        <EmptyState title="Nothing to show yet" body="Log a few transactions and your spending picture appears here." />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Card>
            <Text style={[typography.body, { color: colors.textSecondary }]}>Average saving rate</Text>
            <Text style={[typography.hero, { color: colors.textPrimary, fontSize: 52, lineHeight: 58 }]}>
              {data.avgSavingRate === null ? 'No data' : `${Math.round(data.avgSavingRate * 100)}%`}
            </Text>
            <Text style={[typography.body, { color: colors.textSecondary }]}>
              {data.avgSaved === null ? 'Needs at least one finished month with income.' : `About ${formatMoney(data.avgSaved)} kept per month, over past months.`}
            </Text>
          </Card>

          <Card>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Income and spending</Text>
            <MonthColumns months={data.months} />
            <View style={styles.legend}>
              <Text style={[typography.bodySmall, { color: colors.income }]}>■ Income</Text>
              <Text style={[typography.bodySmall, { color: colors.textPrimary }]}>■ Spending</Text>
            </View>
          </Card>

          <Card>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Where {monthLabel(thisMonth)} is going</Text>
            {data.thisMonth.length === 0 ? (
              <Text style={[typography.body, { color: colors.textSecondary }]}>No spending yet this month.</Text>
            ) : (
              <CategoryBars
                items={data.thisMonth.map((c) => ({ key: String(c.categoryId), name: c.name, icon: c.icon, color: c.color, total: c.total }))}
                compareTo={lastByKey}
              />
            )}
          </Card>

          <Card>
            <Text style={[typography.title, { color: colors.textPrimary }]}>Top places for fun money</Text>
            <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Discretionary spending over the last 90 days. Notes count as the place.</Text>
            {data.topPlaces.length === 0 ? (
              <Text style={[typography.body, { color: colors.textSecondary }]}>Nothing yet.</Text>
            ) : (
              data.topPlaces.map((p, i) => (
                <View key={p.label} style={styles.place}>
                  <Text style={[typography.titleSmall, { color: colors.textSecondary, width: 20 }]}>{i + 1}</Text>
                  <Text numberOfLines={1} style={[typography.titleSmall, { color: colors.textPrimary, flex: 1 }]}>{p.label}</Text>
                  <AmountText minor={p.total} />
                </View>
              ))
            )}
          </Card>
        </ScrollView>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 40, gap: 16 },
  legend: { flexDirection: 'row', gap: 16 },
  place: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
