import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { formatMoney, type Minor } from '../lib/money';
import type { Palette } from '../theme/colors';
import { radius } from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';
import { GoalRing } from './Progress';

/** Mirrors the engine's Verdict.status. Map the engine result to this in the app layer. */
export type VerdictStatus = 'buy_now' | 'almost_there' | 'keep_saving' | 'dont_buy';

export const VERDICT_LABEL: Record<VerdictStatus, string> = {
  buy_now: 'Buy now',
  almost_there: 'Almost there',
  keep_saving: 'Keep saving',
  dont_buy: "Don't buy",
};

export type CheckState = 'pass' | 'fail' | 'warn' | 'info';

/** One line of the explainability checklist: "No verdict without reasons." */
export type VerdictCheck = { state: CheckState; message: string };

type VerdictColors = { accent: string; container: string; onContainer: string };

function verdictColors(c: Palette, status: VerdictStatus): VerdictColors {
  switch (status) {
    case 'buy_now':
      return { accent: c.buy, container: c.buyContainer, onContainer: c.onBuy };
    case 'almost_there':
      return { accent: c.hold, container: c.holdContainer, onContainer: c.onHold };
    case 'keep_saving':
      return { accent: c.save, container: c.saveContainer, onContainer: c.onSave };
    case 'dont_buy':
      return { accent: c.stop, container: c.stopContainer, onContainer: c.onStop };
  }
}

/** Verdict pill. Always carries a text label; color is never the only signal. */
export function VerdictChip({ status }: { status: VerdictStatus }) {
  const { colors } = useTheme();
  const v = verdictColors(colors, status);
  return (
    <View style={[styles.chip, { backgroundColor: v.container }]}>
      <View style={[styles.dot, { backgroundColor: v.accent }]} />
      <Text style={[typography.labelSmall, { color: v.onContainer }]}>{VERDICT_LABEL[status]}</Text>
    </View>
  );
}

/** A single check: icon + the reason, in plain words. */
export function CheckRow({ check }: { check: VerdictCheck }) {
  const { colors } = useTheme();
  const spec = {
    pass: { icon: 'checkmark', tint: colors.buy, spoken: 'Passed' },
    fail: { icon: 'close', tint: colors.stop, spoken: 'Failed' },
    warn: { icon: 'warning', tint: colors.hold, spoken: 'Warning' },
    info: { icon: 'information-circle', tint: colors.textSecondary, spoken: 'Note' },
  } as const;
  const { icon, tint, spoken } = spec[check.state];
  return (
    <View style={styles.checkRow} accessible accessibilityLabel={`${spoken}: ${check.message}`}>
      <Ionicons name={icon} size={18} color={tint} style={styles.checkIcon} />
      <Text style={[typography.body, styles.checkText, { color: colors.textPrimary }]}>
        {check.message}
      </Text>
    </View>
  );
}


export function GoalCard({
  name,
  emoji,
  priceMinor,
  savedMinor,
  status,
  headline,
  checks = [],
  onPress,
  style,
}: {
  name: string;
  emoji: string;
  priceMinor: Minor;
  savedMinor: Minor;
  status: VerdictStatus;
  headline: string;
  checks?: VerdictCheck[];
  onPress?: () => void;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const v = verdictColors(colors, status);
  const progress = priceMinor <= 0 ? 0 : Math.min(1, Math.max(0, savedMinor / priceMinor));

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.outline },
        style,
      ]}
    >
      {/* the verdict edge */}
      <View style={[styles.edge, { backgroundColor: v.accent }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <GoalRing progress={progress} color={v.accent}>
            <Text style={typography.title}>{emoji}</Text>
          </GoalRing>
          <View style={styles.cardTitle}>
            <Text numberOfLines={1} style={[typography.title, { color: colors.textPrimary }]}>
              {name}
            </Text>
            <Text numberOfLines={1} style={[typography.amountSmall, { color: colors.textSecondary }]}>
              {formatMoney(savedMinor)} set aside of {formatMoney(priceMinor)}
            </Text>
          </View>
        </View>
        <View style={styles.chipRow}>
          <VerdictChip status={status} />
        </View>
        <Text style={[typography.body, { color: colors.textPrimary, marginTop: 8 }]}>{headline}</Text>
        {checks.length > 0 ? (
          <View style={styles.checks}>
            {checks.map((c, i) => (
              <CheckRow key={`${i}-${c.message}`} check={c} />
            ))}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkIcon: { marginTop: 1 },
  checkText: { flex: 1 },
  card: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: radius.goal,
    overflow: 'hidden',
  },
  edge: { width: 6 },
  cardBody: { flex: 1, padding: 16 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  cardTitle: { flex: 1, gap: 2 },
  chipRow: { marginTop: 12 },
  checks: { marginTop: 12, gap: 8 },
});
