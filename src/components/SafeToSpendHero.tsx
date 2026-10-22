import { MoneyContext } from '@/services/context';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { formatMoney, getCurrency, type Minor } from '../lib/money';
import { heroShape } from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';
import { AmountText } from './AmountText';
import { AllowanceBar } from './Progress';

// TODO: Make a card themed component that shows all accounts and balances

export function SafeToSpendHero({
  remainingToday,
  allowanceToday,
  daysLeft,
  overBudgetBy = 0,
  context,
  style,
  hidden = false,
}: {
  remainingToday: Minor;
  allowanceToday: Minor;
  daysLeft: number;
  overBudgetBy?: Minor;
  context: MoneyContext;
  style?: ViewStyle;
  hidden?: boolean;
}) {
  const { colors } = useTheme();
  const overBudget = overBudgetBy > 0;
  const shown = overBudget ? 0 : Math.max(0, remainingToday);
  const fraction =
    allowanceToday <= 0 || overBudget
      ? 0
      : Math.min(1, Math.max(0, remainingToday / allowanceToday));
  const whole = (n: Minor) => formatMoney(n, { decimals: 'never' });

  return (
    <View
      accessible
      accessibilityLabel={`Safe to spend today ${whole(shown)} of ${whole(allowanceToday)}. ${daysLeft} days left in the month.`}
      style={[styles.panel, heroShapeStyle, { backgroundColor: colors.hero }, style]}
    >
      <Text style={[typography.body, { color: colors.onHeroMuted }]}>Safe to spend today</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[typography.hero, styles.amount, { color: colors.onHero }]}
      >
        {whole(shown)}
      </Text>
      <AllowanceBar
        remainingFraction={fraction}
        trackColor={colors.heroTrack}
        fillColor={colors.heroAccent}
      />
      <View style={styles.footer}>
        {overBudget ? (
          <Text style={[typography.label, { color: colors.heroAccent }]}>
            Over budget by {whole(overBudgetBy)}
          </Text>
        ) : (
          <Text style={[typography.body, { color: colors.onHeroMuted }]}>
            of {whole(allowanceToday)} today
          </Text>
        )}
        <Text style={[typography.body, { color: colors.onHeroMuted }]}>
          {daysLeft <= 1 ? 'Last day of the month' : `${daysLeft} days left`}
        </Text>
      </View>
      <View style={styles.stat}>
        <Text style={[typography.title, { color: colors.onHeroMuted }]}>Liquid Money</Text>
        <AmountText minor={context.liquid} format={getCurrency()} style={typography.amountLarge} hidden={hidden} />
      </View>
    </View>
  );
}

export function SafeToSpendHeroOriginal({
  remainingToday,
  allowanceToday,
  daysLeft,
  overBudgetBy = 0,
  style,
}: {
  remainingToday: Minor;
  allowanceToday: Minor;
  daysLeft: number;
  overBudgetBy?: Minor;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const overBudget = overBudgetBy > 0;
  const shown = overBudget ? 0 : Math.max(0, remainingToday);
  const fraction =
    allowanceToday <= 0 || overBudget
      ? 0
      : Math.min(1, Math.max(0, remainingToday / allowanceToday));
  const whole = (n: Minor) => formatMoney(n, { decimals: 'never' });

  return (
    <View
      accessible
      accessibilityLabel={`Safe to spend today ${whole(shown)} of ${whole(allowanceToday)}. ${daysLeft} days left in the month.`}
      style={[styles.panel, heroShapeStyle, { backgroundColor: colors.hero }, style]}
    >
      <Text style={[typography.body, { color: colors.onHeroMuted }]}>Safe to spend today</Text>
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        style={[typography.hero, styles.amount, { color: colors.onHero }]}
      >
        {whole(shown)}
      </Text>
      <AllowanceBar
        remainingFraction={fraction}
        trackColor={colors.heroTrack}
        fillColor={colors.heroAccent}
      />
      <View style={styles.footer}>
        {overBudget ? (
          <Text style={[typography.label, { color: colors.heroAccent }]}>
            Over budget by {whole(overBudgetBy)}
          </Text>
        ) : (
          <Text style={[typography.body, { color: colors.onHeroMuted }]}>
            of {whole(allowanceToday)} today
          </Text>
        )}
        <Text style={[typography.body, { color: colors.onHeroMuted }]}>
          {daysLeft <= 1 ? 'Last day of the month' : `${daysLeft} days left`}
        </Text>
      </View>
    </View>
  );
}

const heroShapeStyle: ViewStyle = { ...heroShape };

const styles = StyleSheet.create({
  panel: { paddingHorizontal: 24, paddingVertical: 22 },
  amount: { marginTop: 4, marginBottom: 18 },
  stat: { flex: 1, gap: 2, marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  footer: { marginTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
});
