import { useHaptics } from '@/hooks/useHaptics';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle
} from 'react-native';
import { addDays, dayLabel, type ISODate } from '../engine/dates';
import { getCurrency } from '../lib/money';
import { MIN_TOUCH, radius, spacing } from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, typography } from '../theme/typography';
import { ChoiceChip } from './ChoiceChip';
import { Screen } from './Screen';

// Helper funcs

const isoToDate = (iso: ISODate): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};
const dateToIso = (dt: Date): ISODate =>
  `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}` as ISODate;


/** Top bar for pushed screens: a back arrow, the title, and an optional action on the right. */
export function ScreenHeader({ title, right, onBack }: { title: string; right?: React.ReactNode; onBack?: () => void }) {
  const { colors } = useTheme();
  const router = useRouter();
  return (
    <View style={styles.header}>
      <Pressable
        onPress={onBack ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))}
        accessibilityRole="button"
        accessibilityLabel="Go back"
        hitSlop={8}
        style={styles.back}
      >
        <Ionicons name="arrow-back" size={24} color={colors.textPrimary} />
      </Pressable>
      <Text accessibilityRole="header" numberOfLines={1} style={[typography.headline, styles.headerTitle, { color: colors.textPrimary }]}>
        {title}
      </Text>
      {right}
    </View>
  );
}

/** A pushed form screen: header, scrolling body that makes room for the keyboard, and a pinned footer for the main button. */
export function FormScreen({
  title,
  children,
  footer,
  headerRight,
}: {
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  headerRight?: React.ReactNode;
}) {
  return (
    <Screen>
      <ScreenHeader title={title} right={headerRight} />
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <ScrollView
          contentContainerStyle={styles.formBody}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[typography.label, { color: colors.textSecondary }]}>{label}</Text>
      {children}
      {error ? (
        <Text style={[typography.bodySmall, { color: colors.stopText }]}>{error}</Text>
      ) : hint ? (
        <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

export function TextField({
  label,
  hint,
  error,
  ...input
}: TextInputProps & { label: string; hint?: string; error?: string }) {
  const { colors } = useTheme();
  return (
    <Field label={label} hint={hint} error={error}>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={colors.textSecondary}
        {...input}
        style={[
          styles.input,
          { color: colors.textPrimary, borderColor: error ? colors.stop : colors.outline, backgroundColor: colors.surface, fontFamily: fonts.body },
          input.style,
        ]}
      />
    </Field>
  );
}

/** Keeps only digits and one decimal point with at most two decimals: "12.345" -> "12.34". */
export function sanitizeAmount(text: string): string {
  const cleaned = text.replace(/[^\d.]/g, '');
  const [whole, ...rest] = cleaned.split('.');
  if (rest.length === 0) return whole.slice(0, 9);
  return `${whole.slice(0, 9)}.${rest.join('').slice(0, 2)}`;
}

/** An amount in rupees (or the chosen currency). Holds text; turn it into minor units with parseToMinor. */
export function MoneyField({
  label,
  value,
  onChangeText,
  hint,
  error,
  placeholder = '0',
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  hint?: string;
  error?: string;
  placeholder?: string;
}) {
  const { colors } = useTheme();
  return (
    <Field label={label} hint={hint} error={error}>
      <View style={[styles.moneyWrap, { borderColor: error ? colors.stop : colors.outline, backgroundColor: colors.surface }]}>
        <Text style={[typography.title, { color: colors.textSecondary }]}>{getCurrency().symbol}</Text>
        <TextInput
          accessibilityLabel={label}
          value={value}
          onChangeText={(t) => onChangeText(sanitizeAmount(t))}
          keyboardType="decimal-pad"
          placeholder={placeholder}
          placeholderTextColor={colors.textDisabled}
          style={[styles.moneyInput, { color: colors.textPrimary, fontFamily: fonts.semibold }]}
        />
      </View>
    </Field>
  );
}

/** Single choice from a short list, shown as chips. */
export function OptionChips<T extends string | number>({
  label,
  options,
  value,
  onChange,
  hint,
}: {
  label?: string;
  options: { value: T; label: string; emoji?: string }[];
  value: T | null;
  onChange: (value: T) => void;
  hint?: string;
}) {
  const haptics = useHaptics();
  const body = (
    <View style={styles.chips}>
      {options.map((o) => (
        <ChoiceChip key={String(o.value)} label={o.label} leadingEmoji={o.emoji} selected={o.value === value} onPress={haptics(() => onChange(o.value), "light")} />
      ))}
    </View>
  );
  return label ? (
    <Field label={label} hint={hint}>
      {body}
    </Field>
  ) : (
    body
  );
}

export function ToggleRow({
  label,
  hint,
  value,
  onValueChange,
  disabled,
}: {
  label: string;
  hint?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const haptics = useHaptics();
  return (
    <View style={[styles.toggleRow, disabled && { opacity: 0.5 }]}>
      <View style={styles.fill}>
        <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>{label}</Text>
        {hint ? <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{hint}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={haptics((v) => onValueChange(v), "light")}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ false: colors.outline, true: colors.primary }}
        thumbColor={colors.isDark ? colors.textPrimary : '#FFFFFF'}
      />
    </View>
  );
}

type ButtonKind = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({
  label,
  onPress,
  kind = 'primary',
  disabled,
  style,
}: {
  label: string;
  onPress: () => void;
  kind?: ButtonKind;
  disabled?: boolean;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: 'transparent', fg: colors.textPrimary, border: colors.outline },
    danger: { bg: 'transparent', fg: colors.stopText, border: colors.stop },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
  }[kind];
  const haptics = useHaptics();
  return (
    <Pressable
      onPress={haptics(onPress, 'medium')}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!disabled }}
      style={[
        styles.button,
        { backgroundColor: disabled && kind === 'primary' ? colors.surfaceRaised : palette.bg, borderColor: palette.border },
        style,
      ]}
    >
      <Text style={[typography.label, { color: disabled && kind === 'primary' ? colors.textDisabled : palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

/** A grouped block on a page: a soft surface with a border, used for settings groups and summaries. */
export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.outline }, style]}>{children}</View>
  );
}

/** A number with minus and plus buttons: for months, percentages and "what if" amounts. */
export function Stepper({
  label,
  value,
  onChange,
  step = 1,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  format = (n: number) => String(n),
  hint,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  step?: number;
  min?: number;
  max?: number;
  format?: (n: number) => string;
  hint?: string;
}) {
  const { colors } = useTheme();
  const set = (n: number) => onChange(Math.min(max, Math.max(min, Math.round(n * 100) / 100)));
  return (
    <Field label={label} hint={hint}>
      <View style={styles.stepper}>
        <Pressable
          onPress={() => set(value - step)}
          disabled={value <= min}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          style={[styles.stepButton, { borderColor: colors.outline, opacity: value <= min ? 0.4 : 1 }]}
        >
          <Ionicons name="remove" size={22} color={colors.textPrimary} />
        </Pressable>
        <Text accessibilityLabel={`${label}: ${format(value)}`} style={[typography.amountLarge, styles.stepValue, { color: colors.textPrimary }]}>
          {format(value)}
        </Text>
        <Pressable
          onPress={() => set(value + step)}
          disabled={value >= max}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          style={[styles.stepButton, { borderColor: colors.outline, opacity: value >= max ? 0.4 : 1 }]}
        >
          <Ionicons name="add" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
    </Field>
  );
}

export function DateField({
  label = 'Date',
  value,
  onChange,
  today,
  allowFuture = false,
}: {
  label?: string;
  value: ISODate;
  onChange: (d: ISODate) => void;
  today: ISODate;
  allowFuture?: boolean;
}) {
  const { colors } = useTheme();
  const haptics = useHaptics();
  const [showIosPicker, setShowIosPicker] = useState(false);
  const canForward = allowFuture || value < today;
  const maximumDate = allowFuture ? undefined : isoToDate(today);
 
  const openPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: isoToDate(value),
        mode: 'date',
        maximumDate,
        onChange: (event, date) => {
          if (event.type === 'set' && date) onChange(dateToIso(date));
        },
      });
    } else {
      setShowIosPicker(true);
    }
  };
  return (
    <Field label={label}>
      <View style={styles.stepper}>
        <Pressable
          onPress={haptics(() => onChange(addDays(value, -1)), 'light')}
          accessibilityRole="button"
          accessibilityLabel="Previous day"
          style={[styles.stepButton, { borderColor: colors.outline }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.textPrimary} />
        </Pressable>
 
        {/* Tap the date to jump anywhere via the calendar */}
        <Pressable
          onPress={haptics(openPicker, 'light')}
          accessibilityRole="button"
          accessibilityLabel={`${dayLabel(value, today)}. Tap to pick a date from the calendar`}
          style={styles.dateTap}
        >
          <Text style={[typography.title, { color: colors.textPrimary }]}>{dayLabel(value, today)}</Text>
          <Ionicons name="calendar-outline" size={18} color={colors.textPrimary} />
        </Pressable>
 
        <Pressable
          onPress={haptics(() => canForward && onChange(addDays(value, 1)), 'light')}
          disabled={!canForward}
          accessibilityRole="button"
          accessibilityLabel="Next day"
          style={[styles.stepButton, { borderColor: colors.outline, opacity: canForward ? 1 : 0.4 }]}
        >
          <Ionicons name="chevron-forward" size={22} color={colors.textPrimary} />
        </Pressable>
      </View>
 
      <View style={styles.chips}>
        <ChoiceChip label="Today" selected={value === today} onPress={haptics(() => onChange(today), 'light')} />
        <ChoiceChip label="Yesterday" selected={value === addDays(today, -1)} onPress={haptics(() => onChange(addDays(today, -1)), 'light')} />
      </View>
 
      {/* iOS has no imperative picker, so show the inline calendar in a modal */}
      {Platform.OS === 'ios' && (
        <Modal visible={showIosPicker} transparent animationType="fade" onRequestClose={() => setShowIosPicker(false)}>
          <Pressable style={styles.pickerBackdrop} onPress={() => setShowIosPicker(false)}>
            <Pressable style={[styles.pickerSheet, { backgroundColor: colors.surface, borderColor: colors.outline }]}>
              <DateTimePicker
                value={isoToDate(value)}
                mode="date"
                display="inline"
                maximumDate={maximumDate}
                onChange={(_, date) => {
                  setShowIosPicker(false);
                  if (date) onChange(dateToIso(date));
                }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      )}
    </Field>
  );
}

/** A tappable list line with a chevron: used on Settings to open another screen. */
export function LinkRow({ label, hint, onPress, value }: { label: string; hint?: string; onPress: () => void; value?: string }) {
  const { colors } = useTheme();
  const haptics = useHaptics();
  return (
    <Pressable onPress={haptics(onPress, 'light')} accessibilityRole="button" android_ripple={{ color: colors.outline }} style={styles.linkRow}>
      <View style={styles.fill}>
        <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>{label}</Text>
        {hint ? <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>{hint}</Text> : null}
      </View>
      {value ? <Text style={[typography.body, { color: colors.textSecondary }]}>{value}</Text> : null}
      <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  header: { minHeight: 56, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, gap: 4 },
  back: { width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1 },
  formBody: { paddingHorizontal: spacing.screen, paddingTop: 8, paddingBottom: 32, gap: 18 },
  footer: { paddingHorizontal: spacing.screen, paddingBottom: 16, paddingTop: 8, gap: 8 },
  field: { gap: 6 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.key, paddingHorizontal: 16, fontSize: 16 },
  moneyWrap: { minHeight: 52, borderWidth: 1, borderRadius: radius.key, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  moneyInput: { flex: 1, fontSize: 20, paddingVertical: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  toggleRow: { minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', gap: 12 },
  button: { minHeight: 52, borderRadius: radius.key, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  card: { borderWidth: 1, borderRadius: radius.goal, padding: 16, gap: 14 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepButton: { width: MIN_TOUCH, height: MIN_TOUCH, borderRadius: MIN_TOUCH / 2, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepValue: { flex: 1, textAlign: 'center' },
  linkRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dateTap: { flex: 1, minHeight: MIN_TOUCH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  pickerSheet: { borderWidth: 1, borderRadius: radius.goal, padding: 12 },
});
