import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { monthShort } from '../engine/dates';
import { formatMoney, type Minor } from '../lib/money';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, typography } from '../theme/typography';
import { CategoryBadge } from './Rows';

/** Horizontal bars: where the money went, biggest first. Each bar is relative to the largest. */
export function CategoryBars({
  items,
  compareTo,
}: {
  items: { key: string; name: string; icon: string; color: string; total: Minor }[];
  /** Last month's totals by key, shown as a small caption. */
  compareTo?: Record<string, Minor>;
}) {
  const { colors } = useTheme();
  const max = Math.max(1, ...items.map((i) => i.total));
  return (
    <View style={styles.bars}>
      {items.map((i) => {
        const prev = compareTo?.[i.key];
        return (
          <View key={i.key} accessible accessibilityLabel={`${i.name}: ${formatMoney(i.total)}`} style={styles.barRow}>
            <CategoryBadge emoji={i.icon} tint={i.color} size={36} />
            <View style={styles.barBody}>
              <View style={styles.barTop}>
                <Text numberOfLines={1} style={[typography.titleSmall, { color: colors.textPrimary, flex: 1 }]}>
                  {i.name}
                </Text>
                <Text style={[typography.amountRow, { color: colors.textPrimary }]}>{formatMoney(i.total)}</Text>
              </View>
              <View style={[styles.track, { backgroundColor: colors.outline }]}>
                <View style={{ width: `${(i.total / max) * 100}%`, height: 8, borderRadius: 4, backgroundColor: i.color }} />
              </View>
              {prev !== undefined ? (
                <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Last month {formatMoney(prev)}</Text>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

/** Income (green) and spending (ink) per month, side by side. */
export function MonthColumns({ months, height = 150 }: { months: { month: string; income: Minor; expense: Minor }[]; height?: number }) {
  const { colors } = useTheme();
  const width = 320;
  const labelH = 20;
  const plotH = height - labelH;
  const max = Math.max(1, ...months.flatMap((m) => [m.income, m.expense]));
  const slot = width / months.length;
  const bar = Math.min(16, slot / 3);
  const summary = months.map((m) => `${monthShort(m.month)}: income ${formatMoney(m.income)}, spending ${formatMoney(m.expense)}`).join('. ');
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} accessibilityLabel={summary}>
      {months.map((m, i) => {
        const x = i * slot + slot / 2;
        const incomeH = (m.income / max) * plotH;
        const expenseH = (m.expense / max) * plotH;
        return (
          <React.Fragment key={m.month}>
            <Rect x={x - bar - 1} y={plotH - incomeH} width={bar} height={Math.max(incomeH, m.income > 0 ? 2 : 0)} rx={3} fill={colors.income} />
            <Rect x={x + 1} y={plotH - expenseH} width={bar} height={Math.max(expenseH, m.expense > 0 ? 2 : 0)} rx={3} fill={colors.textPrimary} opacity={0.85} />
            <SvgText x={x} y={height - 4} fontSize={11} fontFamily={fonts.semibold} fill={colors.textSecondary} textAnchor="middle">
              {monthShort(m.month)}
            </SvgText>
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

const styles = StyleSheet.create({
  bars: { gap: 16 },
  barRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  barBody: { flex: 1, gap: 4 },
  barTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  track: { height: 8, borderRadius: 4, overflow: 'hidden' },
});
