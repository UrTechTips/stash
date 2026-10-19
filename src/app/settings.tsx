import { AppUpdate, checkForUpdate } from '@/services/updater';
import * as Application from 'expo-application';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { confirm, useAction } from '../app-state/actions';
import { useApp, useQuery } from '../app-state/AppProvider';
import { Button, Card, LinkRow, MoneyField, OptionChips, Screen, ScreenHeader, Stepper, ToggleRow } from '../components';
import { DEFAULT_SETTINGS, loadSettings, saveSettings, type AppSettings } from '../db/settings';
import type { Tier } from '../engine/types';
import { minorToInput, parseToMinor, setCurrency } from '../lib/money';
import { pickTextFile, shareTextFile } from '../platform/files';
import { lockAvailable, unlock } from '../platform/lock';
import { exportData, importData, transactionsCsv } from '../services/backup';
import { boot } from '../services/bootstrap';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

const CURRENCIES = [
  { value: '₹', label: '₹ Rupee' },
  { value: '$', label: '$ Dollar' },
  { value: '€', label: '€ Euro' },
  { value: '£', label: '£ Pound' },
];

export default function Settings() {
  const router = useRouter();
  const { db, today } = useApp();
  const { colors } = useTheme();
  const run = useAction();
  const { data: s } = useQuery((d) => loadSettings(d));

  const [income, setIncome] = useState('');
  const [essentials, setEssentials] = useState('');
  const [saving, setSaving] = useState('');
  const [hourly, setHourly] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [update, setUpdate] = useState<AppUpdate | null>(null);

  useEffect(() => {
    const checkUpdate = async () => {
      try {
        const update = await checkForUpdate();
        setUpdate(update);
      } catch (error) {
        console.error('Error checking for update:', error);
      }
    }
    checkUpdate();
  }, []);

  // Fill the form once when the saved data arrives (setting state while rendering is the supported way to do this).
  if (s && !loaded) {
    setIncome(s.incomeEstimate ? minorToInput(s.incomeEstimate) : '');
    setEssentials(s.essentialsEstimate ? minorToInput(s.essentialsEstimate) : '');
    setSaving(s.savingRateEstimate ? minorToInput(s.savingRateEstimate) : '');
    setHourly(s.hourlyEarnings ? minorToInput(s.hourlyEarnings) : '');
    setLoaded(true);
  }

  if (!s) return <Screen><ScreenHeader title="Settings" /></Screen>;

  const save = (patch: Partial<AppSettings>) => run(() => saveSettings(db, patch));

  const setTier = (i: number, patch: Partial<Tier>) =>
    save({ tiers: s.tiers.map((t, n) => (n === i ? { ...t, ...patch } : t)) });

  const toggleLock = async (on: boolean) => {
    if (on) {
      if (!(await lockAvailable())) {
        Alert.alert('Set up a screen lock first', 'Stash uses your phone’s fingerprint, face or PIN. Add one in your phone’s settings, then come back.');
        return;
      }
      if (!(await unlock('Turn on app lock'))) return;
    }
    await save({ appLock: on });
  };

  const exportJson = () =>
    run(async () => {
      const data = await exportData(db);
      await shareTextFile(`stash-backup-${today}.json`, JSON.stringify(data, null, 2), 'application/json');
    });

  const exportCsv = () =>
    run(async () => shareTextFile(`stash-transactions-${today}.csv`, await transactionsCsv(db), 'text/csv'));

  const importJson = () =>
    run(async () => {
      const text = await pickTextFile();
      if (text === null) return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        Alert.alert('Check this', 'That file is not a Stash backup.');
        return;
      }
      if (!(await confirm('Replace everything with this backup?', 'All current accounts, transactions, goals and settings are replaced. Export a backup first if you might want them back.', 'Replace', true))) return;
      const summary = await importData(db, parsed);
      await boot(db, today);
      Alert.alert('Backup restored', `${summary.accounts} accounts, ${summary.transactions} transactions and ${summary.goals} goals restored.`);
    });

  return (
    <Screen>
      <ScreenHeader title="Settings" />
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Currency</Text>
          <OptionChips
            options={CURRENCIES}
            value={s.currencySymbol}
            onChange={(symbol) => {
              const format = { symbol, indianGrouping: symbol === '₹', minorDigits: 2 };
              setCurrency(format);
              void save({ currencySymbol: symbol, indianGrouping: symbol === '₹' });
            }}
          />
        </Card>

        <Card>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Buy or Wait</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            A goal is safe to buy when you would still keep your buffer and upcoming bills, plus a cushion of a few times the price.
          </Text>
          <Stepper
            label="Safety buffer"
            value={s.bufferMonths}
            onChange={(n) => save({ bufferMonths: n })}
            step={0.5}
            min={0.5}
            max={3}
            format={(n) => `${n} ${n === 1 ? 'month' : 'months'}`}
            hint="Months of essential spending that stay untouched."
          />
          {s.tiers.map((t, i) => {
            const last = i === s.tiers.length - 1;
            const lo = i === 0 ? 1 : s.tiers[i - 1].maxPercent + 1;
            const hi = last ? 0 : s.tiers[i + 1].maxPercent - 1;
            return (
              <View key={t.name} style={[styles.tier, { borderColor: colors.outline }]}>
                <Text style={[typography.titleSmall, { color: colors.textPrimary }]}>
                  {t.name[0].toUpperCase() + t.name.slice(1)} purchases{last ? '' : ` (under ${t.maxPercent}% of monthly income)`}
                </Text>
                {last ? null : <Stepper label="Counts as this up to (% of income)" value={t.maxPercent} onChange={(n) => setTier(i, { maxPercent: n })} step={1} min={lo} max={Math.max(lo, hi)} format={(n) => `${n}%`} />}
                <Stepper label="Cushion (times the price)" value={t.multiple} onChange={(n) => setTier(i, { multiple: n })} step={0.5} min={1} max={5} format={(n) => `${n}x`} />
                <Stepper label="Cooling-off" value={t.coolingOffDays} onChange={(n) => setTier(i, { coolingOffDays: n })} step={1} min={0} max={90} format={(n) => (n === 0 ? 'None' : `${n} days`)} />
              </View>
            );
          })}
          <MoneyField label="What you earn per hour (optional)" value={hourly} onChangeText={setHourly} hint="Shows how many hours of work a goal costs." />
          <Button label="Save hourly earnings" kind="secondary" onPress={() => save({ hourlyEarnings: parseToMinor(hourly) ?? 0 })} />
          <Button label="Reset to defaults" kind="ghost" onPress={() => save({ tiers: DEFAULT_SETTINGS.tiers.map((t) => ({ ...t })), bufferMonths: DEFAULT_SETTINGS.bufferMonths })} />
        </Card>

        <Card>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Daily spending number</Text>
          <OptionChips
            options={[{ value: 'rolling', label: 'Rolling' }, { value: 'strict', label: 'Strict' }] as { value: AppSettings['allowanceMode']; label: string }[]}
            value={s.allowanceMode}
            onChange={(allowanceMode) => save({ allowanceMode })}
            hint={s.allowanceMode === 'rolling' ? 'Underspend today and tomorrow’s number grows; overspend and it shrinks.' : 'Every day gets the same amount, with no carry-over.'}
          />
        </Card>

        <Card>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Starting estimates</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Used until Stash has a few months of your real history.</Text>
          <MoneyField label="Monthly income" value={income} onChangeText={setIncome} />
          <MoneyField label="Essentials per month" value={essentials} onChangeText={setEssentials} />
          <MoneyField label="Saved per month" value={saving} onChangeText={setSaving} />
          <Button
            label="Save estimates"
            kind="secondary"
            onPress={() => save({ incomeEstimate: parseToMinor(income) ?? 0, essentialsEstimate: parseToMinor(essentials) ?? 0, savingRateEstimate: parseToMinor(saving) ?? 0 })}
          />
        </Card>

        <Card>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Appearance and security</Text>
          <OptionChips
            options={[{ value: 'system', label: 'Match phone' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }] as { value: AppSettings['theme']; label: string }[]}
            value={s.theme}
            onChange={(theme) => save({ theme })}
          />
          <ToggleRow label="App lock" hint="Ask for your fingerprint, face or phone PIN when you open Stash." value={s.appLock} onValueChange={toggleLock} />
        </Card>

        <Card>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Reminders</Text>
          <ToggleRow label="Bills" hint="A heads-up the day before each bill is due." value={s.billReminders} onValueChange={(v) => save({ billReminders: v })} />
          <ToggleRow label="Goals" hint="A nudge on the day a goal should be safe to buy." value={s.goalReminders} onValueChange={(v) => save({ goalReminders: v })} />
          <ToggleRow label="Weekly backup" hint="A Sunday reminder to export your data." value={s.backupReminder} onValueChange={(v) => save({ backupReminder: v })} />
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Android asks for permission the first time you turn one on.</Text>
        </Card>

        <Card>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Updates</Text>
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>Current Version: {Application.nativeApplicationVersion}</Text>
          <ToggleRow label="Automatic updates" hint="Automatically download and install updates when available." value={s.automaticUpdates} onValueChange={(v) => save({ automaticUpdates: v })} />
          {update && (
            <>
              <Text style={[typography.labelSmall, { color: colors.textPrimary }]}>
                New Version Available: {update.version}
              </Text>
              <Button label="Update" kind="primary" onPress={exportJson} />
            </>
          )}
        </Card>

        <Card>
          <Text style={[typography.title, { color: colors.textPrimary }]}>Your data</Text>
          <LinkRow label="Bills and income" hint="Rent, subscriptions, salary" onPress={() => router.push('/recurring')} />
          <LinkRow label="Categories" hint="Essential, discretionary, income" onPress={() => router.push('/categories')} />
          <Text style={[typography.bodySmall, { color: colors.textSecondary }]}>
            Everything lives on this phone only. Export a backup now and then; it is a plain file you can keep anywhere.
          </Text>
          <Button label="Export backup (JSON)" kind="secondary" onPress={exportJson} />
          <Button label="Export transactions (CSV)" kind="secondary" onPress={exportCsv} />
          <Button label="Restore from backup" kind="secondary" onPress={importJson} />
        </Card>

        <Text style={[typography.bodySmall, styles.version, { color: colors.textSecondary }]}>
          Stash {Constants.expoConfig?.version ?? ''}
        </Text>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: 20, paddingBottom: 48, gap: 16 },
  tier: { borderTopWidth: 1, paddingTop: 14, gap: 14 },
  version: { textAlign: 'center' },
});
