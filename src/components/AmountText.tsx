import React from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { formatMoney, type CurrencyFormat, type DecimalMode, type Minor } from '../lib/money';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

export type AmountKind = 'expense' | 'income' | 'transfer' | 'neutral';

type Props = {
  minor: Minor;
  kind?: AmountKind;
  style?: StyleProp<TextStyle>;
  decimals?: DecimalMode;
  format?: CurrencyFormat;
  /** Overrides the color that `kind` would pick. */
  color?: string;
};

/**
 * One place that knows how money looks.
 * Expenses stay in normal ink (not red); only income gets a color.
 * Pass a positive magnitude; `kind` decides how it is drawn.
 */
export function AmountText({ minor, kind = 'neutral', style, decimals, format, color }: Props) {
  const { colors } = useTheme();
  const resolved =
    color ??
    (kind === 'income'
      ? colors.income
      : kind === 'transfer'
        ? colors.textSecondary
        : colors.textPrimary);
  // Income shows a "+", expenses show nothing: the row already says what it is.
  const text = formatMoney(minor, { decimals, format, signed: kind === 'income' });
  return (
    <Text numberOfLines={1} style={[typography.amountRow, { color: resolved }, style]}>
      {text}
    </Text>
  );
}
