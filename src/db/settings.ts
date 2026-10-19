import { DEFAULT_TIERS } from '../engine/defaults';
import type { EngineSettings, Tier } from '../engine/types';
import type { AllowanceMode } from '../engine/types';
import type { Db } from './Db';
import type { Minor } from './types';

export interface AppSettings {
  // Money
  currencySymbol: string;
  indianGrouping: boolean;

  // Buy-or-Wait
  bufferMonths: number;
  tiers: Tier[];
  needMultiple: number;
  /** Hourly earnings in minor units; 0 hides the work-hours figure. */
  hourlyEarnings: Minor;

  // Daily allowance
  allowanceMode: AllowanceMode;

  // Fallbacks for a new user with no history yet
  incomeEstimate: Minor;
  essentialsEstimate: Minor;
  savingRateEstimate: Minor;

  // App
  theme: 'system' | 'light' | 'dark';
  appLock: boolean;
  billReminders: boolean;
  goalReminders: boolean;
  backupReminder: boolean;
  automaticUpdates: boolean;
  onboarded: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  currencySymbol: '₹',
  indianGrouping: true,
  bufferMonths: 1,
  tiers: DEFAULT_TIERS.map((t) => ({ ...t })),
  needMultiple: 1,
  hourlyEarnings: 0,
  allowanceMode: 'rolling',
  incomeEstimate: 0,
  essentialsEstimate: 0,
  savingRateEstimate: 0,
  theme: 'system',
  appLock: false,
  billReminders: false,
  goalReminders: false,
  backupReminder: false,
  automaticUpdates: true,
  onboarded: false,
};

// Infinity cannot be written as JSON, so the last tier is stored with a very large number.
const BIG = 1e9;
const encodeTiers = (tiers: Tier[]) => tiers.map((t) => ({ ...t, maxPercent: Number.isFinite(t.maxPercent) ? t.maxPercent : BIG }));
const decodeTiers = (tiers: Tier[]) => tiers.map((t) => ({ ...t, maxPercent: t.maxPercent >= BIG ? Infinity : t.maxPercent }));

export async function loadSettings(db: Db): Promise<AppSettings> {
  const rows = await db.all<{ key: string; value: string }>('SELECT key, value FROM settings');
  const out: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const { key, value } of rows) {
    if (!(key in DEFAULT_SETTINGS)) continue;
    try {
      out[key] = JSON.parse(value);
    } catch {
      // ignore a corrupt value and keep the default
    }
  }
  const settings = out as unknown as AppSettings;
  settings.tiers = decodeTiers(settings.tiers);
  return settings;
}

export async function saveSettings(db: Db, patch: Partial<AppSettings>): Promise<void> {
  await db.transaction(async (tx) => {
    for (const [key, raw] of Object.entries(patch)) {
      if (!(key in DEFAULT_SETTINGS) || raw === undefined) continue;
      const value = key === 'tiers' ? encodeTiers(raw as Tier[]) : raw;
      await tx.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [
        key,
        JSON.stringify(value),
      ]);
    }
  });
}

export function toEngineSettings(s: AppSettings): EngineSettings {
  return {
    currency: { symbol: s.currencySymbol, indianGrouping: s.indianGrouping, minorDigits: 2 },
    bufferMonths: s.bufferMonths,
    tiers: s.tiers,
    needMultiple: s.needMultiple,
    hourlyEarnings: s.hourlyEarnings > 0 ? s.hourlyEarnings : undefined,
  };
}
