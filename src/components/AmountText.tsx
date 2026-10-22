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
  hidden?: boolean;
};

export function AmountText({ minor, kind = 'neutral', style, decimals, format, color, hidden = false }: Props) {
  const { colors } = useTheme();
  const resolved =
    color ??
    (kind === 'income'
      ? colors.income
      : kind === 'transfer'
        ? colors.textSecondary
        : colors.textPrimary);
  const text = formatMoney(minor, { decimals, format, signed: kind === 'income' });
  const hiddenText = `${format?.symbol}*,***`;
  return (
    <Text numberOfLines={1} style={[typography.amountRow, { color: resolved }, style]}>
      {hidden ? hiddenText : text}
    </Text>
  );
}
