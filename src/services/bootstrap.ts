import type { Db } from '../db/Db';
import { materializeDue } from '../db/recurring';
import { listAccounts } from '../db/accounts';
import { migrate, type MigrateHooks } from '../db/migrations';
import { seedIfEmpty } from '../db/seed';
import { loadSettings } from '../db/settings';
import { setCurrency } from '../lib/money';
import type { ISODate } from '../engine/dates';

export interface BootResult {
  /** True until the user has finished setup (no accounts yet). */
  firstRun: boolean;
  createdFromRules: number;
}

/** Brings the database up to date, seeds it, creates any due recurring transactions, applies the currency. */
export async function boot(db: Db, today: ISODate, hooks: MigrateHooks = {}): Promise<BootResult> {
  await migrate(db, hooks);
  await seedIfEmpty(db);
  const createdFromRules = await materializeDue(db, today);
  const settings = await loadSettings(db);
  setCurrency({ symbol: settings.currencySymbol, indianGrouping: settings.indianGrouping, minorDigits: 2 });
  const accounts = await listAccounts(db, { includeArchived: true });
  return { firstRun: accounts.length === 0 && !settings.onboarded, createdFromRules };
}

/** True until the user has created an account or finished setup. Drives the first-run screen. */
export async function needsOnboarding(db: Db): Promise<boolean> {
  const accounts = await listAccounts(db, { includeArchived: true });
  return accounts.length === 0 && !(await loadSettings(db)).onboarded;
}
