// Test-only helpers: render real screens against a real (in-memory) SQLite database.
import { render } from '@testing-library/react-native';
import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppContext } from '../app-state/AppProvider';
import { withChangeEvents, type Db } from '../db/Db';
import { createAccount } from '../db/accounts';
import { setBudget } from '../db/budgets';
import { listCategories } from '../db/categories';
import { allocateToGoal, createGoal } from '../db/goals';
import { createRule } from '../db/recurring';
import { saveSettings } from '../db/settings';
import { openMemoryDb } from '../db/testing';
import { addTransaction } from '../db/transactions';
import { boot } from '../services/bootstrap';
import { ThemeProvider } from '../theme/ThemeProvider';

export const TODAY = '2026-10-14';
export const rupees = (n: number) => n * 100;

const metrics = { frame: { x: 0, y: 0, width: 390, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

/** A booted, empty database wrapped the way the app wraps it (change events on). */
export async function newDb(): Promise<Db> {
  const db = withChangeEvents(openMemoryDb());
  await boot(db, TODAY);
  return db;
}

/** The keyboard example from the project doc, as real rows. */
export async function seedKeyboardScenario(db: Db) {
  await saveSettings(db, { essentialsEstimate: rupees(10_000), incomeEstimate: rupees(25_000), savingRateEstimate: rupees(4_000), onboarded: true });
  const bank = await createAccount(db, { name: 'HDFC', type: 'bank', openingBalance: rupees(14_500) });
  const cash = await createAccount(db, { name: 'Cash', type: 'cash', openingBalance: rupees(240) });
  const cats = Object.fromEntries((await listCategories(db)).map((c) => [c.name, c.id]));
  await setBudget(db, '2026-10', { total: rupees(30_000), carryOver: false, limits: { [cats['Games']]: rupees(1_800) } });
  await createRule(db, { type: 'expense', amount: rupees(2_000), accountId: bank, categoryId: cats['Bills'], note: 'Broadband', cadence: 'monthly', startDate: '2026-10-20' });
  await createRule(db, { type: 'income', amount: rupees(25_000), accountId: bank, categoryId: cats['Salary'], note: 'Stipend', cadence: 'monthly', startDate: '2026-10-31' });
  const goal = await createGoal(db, { name: 'Mechanical keyboard', price: rupees(3_000), type: 'want', priority: 2 }, '2026-10-05');
  await allocateToGoal(db, goal, bank, rupees(3_000), '2026-10-06');
  await addTransaction(db, { type: 'expense', amount: rupees(240), date: TODAY, accountId: cash, categoryId: cats['Eating out'], note: 'Lunch' });
  return { bank, cash, goal, cats };
}

export async function renderWithApp(ui: React.ReactElement, db: Db) {
  const value = { db, today: TODAY, firstRun: false, refresh: async () => undefined };
  const result = await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ThemeProvider>
        <AppContext.Provider value={value}>{ui}</AppContext.Provider>
      </ThemeProvider>
    </SafeAreaProvider>,
  );
  await settle(); // let the first queries finish
  return result;
}

/** Lets pending queries finish and the UI settle. */
export async function settle() {
  const { act } = require('@testing-library/react-native');
  await act(async () => {
    await new Promise((r) => setTimeout(r, 30));
  });
}
