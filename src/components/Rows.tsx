import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { formatMoney, type Minor } from '../lib/money';
import { MIN_TOUCH, radius, spacing } from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';
import { AmountText, type AmountKind } from './AmountText';
import { PaceBar } from './Progress';

/** Section title with an optional text action on the right ("See all"). Sentence case, no eyebrow labels. */
export function SectionHeader({
  title,
  actionLabel,
  onAction,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.sectionHeader}>
      <Text accessibilityRole="header" style={[typography.headline, { color: colors.textPrimary }]}>
        {title}
      </Text>
      {actionLabel && onAction ? (
        <Pressable
          onPress={onAction}
          accessibilityRole="button"
          style={styles.sectionAction}
          hitSlop={8}
        >
          <Text style={[typography.label, { color: colors.primary }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * Category icon. A soft square tinted with the category color, holding an emoji.
 * Emoji keep this dependency-free; swap for vector icons later if you want.
 */
export function CategoryBadge({
  emoji,
  tint,
  size = 40,
}: {
  emoji: string;
  tint: string;
  size?: number;
}) {
  const { isDark } = useTheme();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius.badge,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(tint, isDark ? 0.28 : 0.2),
      }}
    >
      <Text style={typography.title}>{emoji}</Text>
    </View>
  );
}

/** "#RRGGBB" + alpha 0..1 -> "#RRGGBBAA". */
function withAlpha(hex: string, alpha: number): string {
  const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
  return `${hex}${a}`;
}

/**
 * One transaction. Flat on the page: no card, no shadow, just a line.
 * Pass the amount as a positive magnitude; `kind` decides how it is drawn.
 */
export function TransactionRow({
  title,
  subtitle,
  amountMinor,
  kind,
  emoji,
  tint,
  onPress,
}: {
  title: string;
  subtitle: string;
  amountMinor: Minor;
  kind: AmountKind;
  emoji: string;
  tint: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={{ color: colors.outline }}
      style={styles.row}
    >
      <CategoryBadge emoji={emoji} tint={tint} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[typography.titleSmall, { color: colors.textPrimary }]}>
          {title}
        </Text>
        <Text numberOfLines={1} style={[typography.bodySmall, { color: colors.textSecondary }]}>
          {subtitle}
        </Text>
      </View>
      <AmountText minor={amountMinor} kind={kind} />
    </Pressable>
  );
}

/** Day group header for the transaction list: "Today" on the left, that day's spending on the right. */
export function DayHeader({ label, spentMinor }: { label: string; spentMinor: Minor }) {
  const { colors } = useTheme();
  return (
    <View style={styles.dayHeader}>
      <Text style={[typography.label, { color: colors.textSecondary }]}>{label}</Text>
      {spentMinor > 0 ? (
        <AmountText minor={spentMinor} style={typography.amountSmall} color={colors.textSecondary} />
      ) : null}
    </View>
  );
}

/**
 * Account line for the Accounts screen.
 * `spendable` false means the money is not counted in "liquid money" (a locked FD, for example).
 */
export function AccountRow({
  name,
  typeLabel,
  balanceMinor,
  spendable,
  emoji,
  tint,
  onPress,
}: {
  name: string;
  typeLabel: string;
  balanceMinor: Minor;
  spendable: boolean;
  emoji: string;
  tint: string;
  onPress?: () => void;
}) {
  const { colors } = useTheme();
  const note = spendable ? typeLabel : `${typeLabel} · not counted as spendable`;
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      android_ripple={{ color: colors.outline }}
      style={[styles.row, { minHeight: 68 }]}
    >
      <CategoryBadge emoji={emoji} tint={tint} />
      <View style={styles.rowText}>
        <Text numberOfLines={1} style={[typography.titleSmall, { color: colors.textPrimary }]}>
          {name}
        </Text>
        <Text numberOfLines={1} style={[typography.bodySmall, { color: colors.textSecondary }]}>
          {note}
        </Text>
      </View>
      <AmountText minor={balanceMinor} />
    </Pressable>
  );
}

/**
 * One budget line: name, what is left, a pace bar, and the spent-of-limit detail.
 * Use it for the monthly total and for each category limit.
 */
export function BudgetRow({
  name,
  spentMinor,
  limitMinor,
  paceFraction,
}: {
  name: string;
  spentMinor: Minor;
  limitMinor: Minor;
  /** How far through the month you are (0.4 = 40%); draws the pace tick. */
  paceFraction: number;
}) {
  const { colors } = useTheme();
  const left = limitMinor - spentMinor;
  const barStyle: ViewStyle = { marginTop: 6, marginBottom: 2 };
  return (
    <View style={styles.budgetRow}>
      <View style={styles.budgetTop}>
        <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>{name}</Text>
        <Text
          style={[
            typography.amountSmall,
            { color: left >= 0 ? colors.textSecondary : colors.stopText },
          ]}
        >
          {left >= 0 ? `${formatMoney(left)} left` : `${formatMoney(-left)} over`}
        </Text>
      </View>
      <PaceBar spent={spentMinor} limit={limitMinor} paceFraction={paceFraction} style={barStyle} />
      <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
        {formatMoney(spentMinor)} of {formatMoney(limitMinor)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeader: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: spacing.screen,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionAction: { minHeight: MIN_TOUCH, paddingHorizontal: 4, justifyContent: 'center' },
  row: {
    minHeight: 64,
    paddingHorizontal: spacing.screen,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  rowText: { flex: 1 },
  dayHeader: {
    paddingHorizontal: spacing.screen,
    paddingTop: 20,
    paddingBottom: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  budgetRow: { paddingHorizontal: spacing.screen, paddingVertical: 10 },
  budgetTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
