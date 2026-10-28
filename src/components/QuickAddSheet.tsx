import { useHaptics } from '@/hooks/useHaptics';
import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { type ISODate } from '../engine/dates';
import { backspace, pressKey } from '../lib/amountInput';
import { formatInput, INR, parseToMinor, type Minor } from '../lib/money';
import { radius, spacing } from '../theme/layout';
import { useTheme } from '../theme/ThemeProvider';
import { fonts, typography } from '../theme/typography';
import { ChoiceChip } from './ChoiceChip';
import { DateField } from './forms';

export type TxType = 'expense' | 'income' | 'transfer';

const TYPE_LABEL: Record<TxType, string> = {
  expense: 'Expense',
  income: 'Income',
  transfer: 'Transfer',
};
const SAVE_LABEL: Record<TxType, string> = {
  expense: 'Save expense',
  income: 'Save income',
  transfer: 'Save transfer',
};

export type CategoryChipData = { id: number; name: string; emoji: string; kind: 'essential' | 'discretionary' | 'income' };
export type AccountChipData = { id: number; name: string };

/** What the sheet hands back. The app layer turns this into a database write. */
export type QuickAddResult = {
  type: TxType;
  amountMinor: Minor;
  /** Today or yesterday; older dates are set when editing the transaction. */
  date: ISODate;
  /** Null means uncategorised. Fast entry beats perfect categorisation. */
  categoryId: number | null;
  accountId: number;
  /** Only set for transfers. */
  toAccountId: number | null;
  note: string;
};

export function QuickAddSheet({
  visible,
  categories,
  accounts,
  today,
  initialType,
  defaultAccountId,
  onClose,
  onSave,
}: {
  visible: boolean;
  categories: CategoryChipData[];
  accounts: AccountChipData[];
  today: ISODate;
  initialType?: TxType;
  /** The account to preselect, usually the one used last. */
  defaultAccountId?: number | null;
  onClose: () => void;
  onSave: (result: QuickAddResult) => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent
      navigationBarTranslucent
    >
      <KeyboardAvoidingView behavior="padding" style={styles.fill}>
        <Pressable
          style={[styles.scrim, { backgroundColor: colors.isDark ? '#000000AA' : '#10261F66' }]}
          onPress={onClose}
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, paddingBottom: Math.max(insets.bottom, 12) + 4 },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.outline }]} />
          <QuickAddForm
            categories={categories}
            accounts={accounts}
            today={today}
            initialType={initialType}
            defaultAccountId={defaultAccountId}
            onSave={onSave}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** The sheet's body on its own, so you can render and test it without a Modal. */
export function QuickAddForm({
  categories,
  accounts,
  today,
  initialType = 'expense',
  defaultAccountId,
  onSave,
}: {
  categories: CategoryChipData[];
  accounts: AccountChipData[];
  today: ISODate;
  initialType?: TxType;
  defaultAccountId?: number | null;
  onSave: (result: QuickAddResult) => void;
}) {
  const { colors } = useTheme();
  const [type, setType] = useState<TxType>(initialType);
  const [daysAgo, setDaysAgo] = useState(0);
  const [date, setDate] = useState<ISODate>(today);
  const [input, setInput] = useState('');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [accountId, setAccountId] = useState<number | null>(
    accounts.find((a) => a.id === defaultAccountId)?.id ?? accounts[0]?.id ?? null,
  );
  const [toAccountId, setToAccountId] = useState<number | null>(null);
  const [note, setNote] = useState('');

  const amountMinor = parseToMinor(input) ?? 0;
  const canSave =
    amountMinor > 0 &&
    accountId !== null &&
    (type !== 'transfer' || (toAccountId !== null && toAccountId !== accountId));

  const save = () => {
    if (!canSave || accountId === null) return;
    onSave({
      type,
      amountMinor,
      date: date,
      categoryId: type === 'transfer' ? null : categoryId,
      accountId,
      toAccountId: type === 'transfer' ? toAccountId : null,
      note: note.trim(),
    });
  };

  return (
    <ScrollView
      contentContainerStyle={styles.form}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      bounces={false}
    >
      <TypeToggle
        selected={type}
        onSelect={(t) => {
          setType(t);
          setCategoryId(null);
        }}
      />

      {/* Amount readout */}
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        accessibilityLabel={`Amount ${formatInput(input)}`}
        style={[
          typography.entry,
          styles.amount,
          { color: input.length === 0 ? colors.textDisabled : colors.textPrimary },
        ]}
      >
        {INR.symbol + formatInput(input)}
      </Text>

      {type !== 'transfer' ? (
        <>
          <FieldLabel text={type === 'income' ? 'Source (optional)' : 'Category (optional)'} />
          <ChipRow>
            {categories
              .filter((c) => (type === 'income' ? c.kind === 'income' : c.kind !== 'income'))
              .map((c) => (
              <ChoiceChip
                key={c.id}
                label={c.name}
                leadingEmoji={c.emoji}
                selected={categoryId === c.id}
                onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
              />
            ))}
          </ChipRow>
        </>
      ) : null}

      <FieldLabel text={type === 'transfer' ? 'From' : 'Account'} />
      <ChipRow>
        {accounts.map((a) => (
          <ChoiceChip
            key={a.id}
            label={a.name}
            selected={accountId === a.id}
            onPress={() => setAccountId(a.id)}
          />
        ))}
      </ChipRow>

      {type === 'transfer' ? (
        <>
          <FieldLabel text="To" />
          <ChipRow>
            {accounts
              .filter((a) => a.id !== accountId)
              .map((a) => (
                <ChoiceChip
                  key={a.id}
                  label={a.name}
                  selected={toAccountId === a.id}
                  onPress={() => setToAccountId(a.id)}
                />
              ))}
          </ChipRow>
        </>
      ) : null}

      {/* <ChipRow>
        {[0, 1].map((n) => (
          <ChoiceChip
            key={n}
            label={n === 0 ? 'Today' : 'Yesterday'}
            selected={daysAgo === n}
            onPress={() => setDaysAgo(n)}
          />
        ))}
      </ChipRow> */}
      <DateField label="Date" value={date} onChange={setDate} today={today} allowFuture={false} />

      <TextInput
        value={note}
        onChangeText={setNote}
        placeholder="Add a note"
        placeholderTextColor={colors.textSecondary}
        returnKeyType="done"
        style={[
          styles.note,
          { color: colors.textPrimary, borderColor: colors.outline, fontFamily: fonts.body },
        ]}
      />

      <Keypad
        onKey={(k) => setInput((cur) => pressKey(cur, k))}
        onBackspace={() => setInput((cur) => backspace(cur))}
      />

      <Pressable
        onPress={save}
        disabled={!canSave}
        accessibilityRole="button"
        accessibilityState={{ disabled: !canSave }}
        style={[
          styles.saveButton,
          { backgroundColor: canSave ? colors.primary : colors.surfaceRaised },
        ]}
      >
        <Text
          style={[typography.label, { color: canSave ? colors.onPrimary : colors.textDisabled }]}
        >
          {SAVE_LABEL[type]}
        </Text>
      </Pressable>
    </ScrollView>
  );
}

function FieldLabel({ text }: { text: string }) {
  const { colors } = useTheme();
  return <Text style={[typography.label, { color: colors.textSecondary }]}>{text}</Text>;
}

function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.chipRow}
    >
      {children}
    </ScrollView>
  );
}

/** Expense / Income / Transfer. A three-way pill, not a stock tab row. */
function TypeToggle({ selected, onSelect }: { selected: TxType; onSelect: (t: TxType) => void }) {
  const { colors } = useTheme();
  const types: TxType[] = ['expense', 'income', 'transfer'];
  return (
    <View style={[styles.toggle, { backgroundColor: colors.surfaceRaised }]}>
      {types.map((t) => {
        const isSelected = t === selected;
        return (
          <Pressable
            key={t}
            onPress={() => onSelect(t)}
            accessibilityRole="tab"
            accessibilityState={{ selected: isSelected }}
            style={[styles.toggleItem, { backgroundColor: isSelected ? colors.surface : 'transparent' }]}
          >
            <Text
              style={[
                typography.label,
                { color: isSelected ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              {TYPE_LABEL[t]}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const KEY_ROWS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['.', '0', 'back'],
] as const;

function Keypad({ onKey, onBackspace }: { onKey: (k: string) => void; onBackspace: () => void }) {
  const { colors } = useTheme();
  const haptics = useHaptics();
  return (
    <View style={styles.keypad}>
      {KEY_ROWS.map((row, i) => (
        <View key={i} style={styles.keyRow}>
          {row.map((key) => (
            <Pressable
              key={key}
              onPress={haptics(() => (key === 'back' ? onBackspace() : onKey(key)), 'light')}
              accessibilityRole="button"
              accessibilityLabel={
                key === 'back' ? 'Delete last digit' : key === '.' ? 'Decimal point' : key
              }
              android_ripple={{ color: colors.outline }}
              style={[styles.key, { backgroundColor: colors.surfaceRaised }]}
            >
              {key === 'back' ? (
                <Ionicons name="backspace-outline" size={26} color={colors.textPrimary} />
              ) : (
                <Text style={[typography.keypad, { color: colors.textPrimary }]}>{key}</Text>
              )}
            </Pressable>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'flex-end' },
  scrim: { ...({ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 } as const) },
  sheet: {
    maxHeight: '92%',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingTop: 8,
  },
  handle: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, marginBottom: 8 },
  form: { paddingHorizontal: spacing.screen, paddingBottom: 8, gap: 12 },
  toggle: { flexDirection: 'row', borderRadius: radius.pill, padding: 4 },
  toggleItem: {
    flex: 1,
    height: 40,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  amount: { textAlign: 'center', paddingVertical: 4 },
  chipRow: { gap: 8, paddingRight: 8 },
  note: {
    height: 52,
    borderWidth: 1,
    borderRadius: radius.key,
    paddingHorizontal: 16,
    fontSize: 14,
  },
  keypad: { gap: 8 },
  keyRow: { flexDirection: 'row', gap: 8 },
  key: {
    flex: 1,
    height: 58,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  saveButton: {
    height: 56,
    borderRadius: radius.key,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
