import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useAnimatedNumber } from '../hooks/useAnimatedNumber';
import { formatMoney, type Minor } from '../lib/money';
import { useTheme } from '../theme/ThemeProvider';

const clamp01 = (n: number) => Math.min(1, Math.max(0, n));
const fractionOf = (part: number, whole: number) => (whole <= 0 ? 0 : clamp01(part / whole));

/**
 * Budget progress with a pace marker.
 *
 * The fill is how much you have spent. The tick is where you "should" be by
 * today (for example 40% through the month). Fill past the tick means you are
 * spending faster than the month is passing.
 *
 * Fill color: primary when on pace, amber when ahead of pace, red when over the limit.
 */
export function PaceBar({
  spent,
  limit,
  paceFraction,
  style,
}: {
  spent: Minor;
  limit: Minor;
  /** How far through the month you are, 0..1. */
  paceFraction: number;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const fraction = fractionOf(spent, limit);
  const animated = useAnimatedNumber(fraction);
  const pace = clamp01(paceFraction);

  const fill =
    limit > 0 && spent > limit ? colors.stop : fraction > pace + 0.05 ? colors.hold : colors.primary;

  return (
    <View
      style={[styles.paceWrap, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={`${formatMoney(spent)} of ${formatMoney(limit)} spent`}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(fraction * 100) }}
    >
      <View style={[styles.paceTrack, { backgroundColor: colors.outline }]} />
      <View
        style={[styles.paceFill, { width: `${animated * 100}%`, backgroundColor: fill }]}
      />
      {/* pace marker: a thin tick that rises above and below the bar */}
      <View
        style={[styles.paceTick, { left: `${pace * 100}%`, backgroundColor: colors.paceMarker }]}
      />
    </View>
  );
}

/**
 * The thin allowance bar inside the hero panel.
 * Full means you have the whole day's allowance left; empty means you have spent it.
 */
export function AllowanceBar({
  remainingFraction,
  trackColor,
  fillColor,
}: {
  remainingFraction: number;
  trackColor: string;
  fillColor: string;
}) {
  const animated = useAnimatedNumber(clamp01(remainingFraction));
  return (
    <View style={[styles.allowanceTrack, { backgroundColor: trackColor }]}>
      <View
        style={[styles.allowanceFill, { width: `${animated * 100}%`, backgroundColor: fillColor }]}
      />
    </View>
  );
}

/**
 * Goal progress ring. Put an emoji or icon in `children`.
 * `progress` is the share of the price that is set aside, 0..1.
 */
export function GoalRing({
  progress,
  color,
  size = 56,
  strokeWidth = 6,
  children,
}: {
  progress: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  children?: React.ReactNode;
}) {
  const { colors } = useTheme();
  const animated = useAnimatedNumber(clamp01(progress), 600);
  const r = (size - strokeWidth) / 2;
  const c = size / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={c} cy={c} r={r} stroke={colors.outline} strokeWidth={strokeWidth} fill="none" />
        <Circle
          cx={c}
          cy={c}
          r={r}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={circumference * (1 - animated)}
          rotation={-90}
          origin={`${c}, ${c}`}
        />
      </Svg>
      <View style={styles.ringCenter} pointerEvents="none">
        {typeof children === 'string' ? <Text>{children}</Text> : children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  paceWrap: { height: 18, justifyContent: 'center' },
  paceTrack: { height: 8, borderRadius: 999 },
  paceFill: { position: 'absolute', left: 0, height: 8, borderRadius: 999 },
  paceTick: { position: 'absolute', top: 0, bottom: 0, width: 2, marginLeft: -1, borderRadius: 1 },
  allowanceTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  allowanceFill: { height: 6, borderRadius: 999 },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
});
