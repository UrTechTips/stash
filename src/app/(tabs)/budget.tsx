import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAction } from '../../app-state/actions';
import { useApp, useQuery } from '../../app-state/AppProvider';
import { BudgetRow, CategoryBadge, MoneyField, PaceBar, Screen, SectionHeader, ToggleRow, useFloatingBarSpace } from '../../components';
import { Button, Card } from '../../components/forms';
import { getBudget, setBudget } from '../../db/budgets';
import { listCategories } from '../../db/categories';
import { daysInMonth, endOfMonth, monthLabel, monthOf, parseISO, shiftMonth } from '../../engine/dates';
import { formatMoney, getCurrency, minorToInput, parseToMinor } from '../../lib/money';
import { loadContext } from '../../services/context';
import { budgetedSpend, spendByCategory } from '../../services/reports';
import { useTheme } from '../../theme/ThemeProvider';
import { fonts, typography } from '../../theme/typography';
import { sanitizeAmount } from '../../components/forms';

export default function Budget() {
  const { db, today } = useApp();
  const { colors } = useTheme();
  const run = useAction();
  const space = useFloatingBarSpace();
  const thisMonth = monthOf(today);
  const [month, setMonth] = useState(thisMonth);
  const [totalText, setTotalText] = useState('');
  const [carry, setCarry] = useState(false);
  const [limits, setLimits] = useState<Record<number, string>>({});
  const [draftKey, setDraftKey] = useState('');
  const [saved, setSaved] = useState(false);

  const { data } = useQuery(async (d, t) => {
    const from = `${month}-01`;
    const to = endOfMonth(from);
    const [budget, categories, spent, total] = await Promise.all([
      getBudget(d, month),
      listCategories(d),
      spendByCategory(d, from, to, { budgetedOnly: true }),
      budgetedSpend(d, from, to),
    ]);
    const ctx = month === monthOf(t) ? await loadContext(d, t) : null;
    return { budget, categories: categories.filter((c) => c.kind !== 'income'), spent, total, ctx };
  }, [month]);

  // Fill the form from the saved budget whenever a different month (or its first load) arrives.
  const key = data ? `${month}|${data.budget?.month ?? 'none'}` : '';
  if (data && key !== draftKey) {
  setTotalText(data.budget ? minorToInput(data.budget.total) : '');
  setCarry(data.budget?.carryOver ?? false);
  setLimits(Object.fromEntries(Object.entries(data.budget?.limits ?? {}).map(([id, v]) => [id, minorToInput(v)])));
  setDraftKey(key);
  setSaved(false);
  }

  if (!data) return <Screen><View /></Screen>;

  const { budget, categories, spent, total, ctx } = data;
  const pace = month === thisMonth ? (ctx?.allowance.paceFraction ?? 0) : month < thisMonth ? 1 : 0;
  const limit = (parseToMinor(totalText) ?? 0) + (month === thisMonth ? (ctx?.carryOver ?? 0) : 0);
  const spentBy = Object.fromEntries(spent.map((s) => [s.categoryId ?? -1, s.total]));
  const dayOf = month === thisMonth ? parseISO(today).d : month < thisMonth ? daysInMonth(...(month.split('-').map(Number) as [number, number])) : 0;

  const save = async () => {
    const result = await run(async () => {
      const limitsMinor: Record<number, number> = {};
      for (const [id, text] of Object.entries(limits)) {
        const v = parseToMinor(text);
        if (v && v > 0) limitsMinor[Number(id)] = v;
      }
      await setBudget(db, month, { total: parseToMinor(totalText) ?? 0, carryOver: carry, limits: limitsMinor });
      return true;
    });
    if (result) setSaved(true);
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingBottom: space + 24 }} keyboardShouldPersistTaps="handled">
        <View style={styles.monthRow}>
          <MonthButton icon="chevron-back" label="Previous month" onPress={() => setMonth(shiftMonth(month, -1))} />
          <Text accessibilityRole="header" style={[typography.headline, { color: colors.textPrimary }]}>{monthLabel(month)}</Text>
          <MonthButton icon="chevron-forward" label="Next month" onPress={() => setMonth(shiftMonth(month, 1))} />
        </View>

        {budget?.inheritedFrom ? (
          <Text style={[typography.body, styles.pad, { color: colors.textSecondary }]}>
            Using {monthLabel(budget.inheritedFrom)}’s budget until you save one for this month.
          </Text>
        ) : null}

        <View style={styles.pad}>
          <Card>
            <MoneyField label="Monthly budget" value={totalText} onChangeText={(t) => { setTotalText(t); setSaved(false); }} hint="Everything you plan to spend this month, bills included." />
            <ToggleRow label="Carry over what I don't spend" hint="Money left from last month is added to this one." value={carry} onValueChange={(v) => { setCarry(v); setSaved(false); }} />
            {month === thisMonth && ctx && ctx.carryOver > 0 ? (
              <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Carried over from last month: {formatMoney(ctx.carryOver)}</Text>
            ) : null}
          </Card>
        </View>

        <SectionHeader title="Spent so far" />
        <BudgetRow name="All spending" spentMinor={total} limitMinor={limit} paceFraction={pace} />
        <Text style={[typography.bodySmall, styles.pad, { color: colors.textSecondary }]}>
          Transfers and goal purchases are not counted. Day {dayOf} of {daysInMonth(...(month.split('-').map(Number) as [number, number]))}.
        </Text>

        {(['essential', 'discretionary'] as const).map((kind) => (
          <View key={kind}>
            <SectionHeader title={kind === 'essential' ? 'Essentials' : 'Discretionary'} />
            {categories.filter((c) => c.kind === kind).map((c) => {
              const s = spentBy[c.id] ?? 0;
              const lim = parseToMinor(limits[c.id] ?? '') ?? 0;
              return (
                <View key={c.id} style={styles.catRow}>
                  <View style={styles.catTop}>
                    <CategoryBadge emoji={c.icon} tint={c.color} size={36} />
                    <View style={styles.flex}>
                      <Text numberOfLines={1} style={[typography.titleSmall, { color: colors.textPrimary }]}>{c.name}</Text>
                      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
                        {formatMoney(s)} spent{lim > 0 ? ` of ${formatMoney(lim)}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.limitBox, { borderColor: colors.outline, backgroundColor: colors.surface }]}>
                      <Text style={[typography.body, { color: colors.textSecondary }]}>{getCurrency().symbol}</Text>
                      <TextInput
                        value={limits[c.id] ?? ''}
                        onChangeText={(t) => { setLimits((l) => ({ ...l, [c.id]: sanitizeAmount(t) })); setSaved(false); }}
                        keyboardType="decimal-pad"
                        placeholder="Limit"
                        placeholderTextColor={colors.textDisabled}
                        accessibilityLabel={`${c.name} monthly limit`}
                        style={[styles.limitInput, { color: colors.textPrimary, fontFamily: fonts.semibold }]}
                      />
                    </View>
                  </View>
                  {lim > 0 ? <PaceBar spent={s} limit={lim} paceFraction={pace} style={{ marginTop: 8 }} /> : null}
                </View>
              );
            })}
          </View>
        ))}

        <View style={[styles.pad, { marginTop: 20, gap: 8 }]}>
          <Button label={saved ? 'Saved' : 'Save budget'} onPress={save} disabled={saved} />
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Category limits are optional. The discretionary ones also tell the Buy-or-Wait budget check how much fun money is left.
          </Text>
        </View>
      </ScrollView>
    </Screen>
  );
}

function MonthButton({ icon, label, onPress }: { icon: 'chevron-back' | 'chevron-forward'; label: string; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.monthButton}>
      <Ionicons name={icon} size={24} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  monthRow: { paddingHorizontal: 12, minHeight: 64, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  monthButton: { width: 48, height: 48, alignItems: 'center', justifyContent: 'center' },
  pad: { paddingHorizontal: 20 },
  flex: { flex: 1 },
  catRow: { paddingHorizontal: 20, paddingVertical: 10 },
  catTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  limitBox: { width: 112, minHeight: 44, borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  limitInput: { flex: 1, fontSize: 15, paddingVertical: 6 },
});
