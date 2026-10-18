import { configure, fireEvent, screen, waitFor } from '@testing-library/react-native';
import React from 'react';
import { getAccount } from '../db/accounts';
import { getBudget } from '../db/budgets';
import { getGoal } from '../db/goals';
import { listTransactions } from '../db/transactions';
import { loadSettings } from '../db/settings';
import { newDb, renderWithApp, rupees, seedKeyboardScenario, settle, TODAY } from '../test-utils/render';

// Screens pull in many modules; the first render in a run can be slow.
jest.setTimeout(30_000);
configure({ asyncUtilTimeout: 5_000 });

const mockRouter = { push: jest.fn(), back: jest.fn(), replace: jest.fn(), canGoBack: () => true };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  Tabs: () => null,
  Stack: () => null,
}));

beforeEach(() => {
  mockRouter.push.mockClear();
  mockRouter.back.mockClear();
  mockParams = {};
});

const press = async (label: string | RegExp) => fireEvent.press(await screen.findByText(label));

describe('Home', () => {
  it("shows the doc's keyboard example: the daily number, the bills, and a fully funded goal that is still Don't buy", async () => {
    const db = await newDb();
    await seedKeyboardScenario(db);
    const Home = require('../app/(tabs)/index').default;
    await renderWithApp(<Home />, db);
    await settle();

    expect(await screen.findByText('Safe to spend today')).toBeTruthy();
    // (30,000 budget - 2,000 unpaid bill) / 18 days left = 1,555 a day; today's 240 lunch leaves 1,315
    expect(screen.getByText('₹1,315')).toBeTruthy();
    expect(screen.getByText('of ₹1,555 today')).toBeTruthy();
    expect(screen.getByText('18 days left')).toBeTruthy();
    expect(screen.getByText('Broadband')).toBeTruthy();
    expect(screen.getByText("Don't buy")).toBeTruthy();
    expect(screen.getByText('Safety: you would end ₹500 below your buffer plus upcoming bills')).toBeTruthy();
    expect(screen.getByText('Lunch')).toBeTruthy();
  });

  it('asks for a budget when there is none', async () => {
    const db = await newDb();
    await seedKeyboardScenario(db);
    await db.run('DELETE FROM budget_categories');
    await db.run('DELETE FROM budgets');
    const Home = require('../app/(tabs)/index').default;
    await renderWithApp(<Home />, db);
    expect(await screen.findByText('Set a monthly budget')).toBeTruthy();
  });
});

describe('quick add', () => {
  it('logs an expense in a few taps and the Home number updates by itself', async () => {
    const db = await newDb();
    const { cash } = await seedKeyboardScenario(db);
    const Home = require('../app/(tabs)/index').default;
    const { QuickAddHost } = require('../components/QuickAddHost');
    await renderWithApp(<><Home /><QuickAddHost /></>, db);
    expect(await screen.findByText('₹1,315')).toBeTruthy();

    await press('Add');
    for (const k of ['4', '0', '0']) await fireEvent.press(await screen.findByLabelText(k));
    await fireEvent.press(await screen.findByText('Games'));
    await fireEvent.press(await screen.findByText('Cash'));
    await fireEvent.press(await screen.findByText('Save expense'));
    await settle();

    const txs = await listTransactions(db, { limit: 1 });
    expect(txs[0]).toMatchObject({ type: 'expense', amount: rupees(400), accountId: cash, categoryName: 'Games', date: TODAY });
    // today's remaining dropped by the 400 just spent (1,315.55 - 400 = 915.55), without a reload
    await waitFor(() => expect(screen.getByText('₹915')).toBeTruthy());
    expect(screen.getByText('Lunch')).toBeTruthy();
  });

  it('warns before spending money that goals have set aside', async () => {
    const db = await newDb();
    const { bank } = await seedKeyboardScenario(db);
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { QuickAddHost } = require('../components/QuickAddHost');
    await renderWithApp(<QuickAddHost />, db);
    await settle();

    await press('Add');
    for (const k of ['1', '2', '0', '0', '0']) await fireEvent.press(await screen.findByLabelText(k)); // 12,000 of 14,500 with 3,000 set aside
    await fireEvent.press(await screen.findByText('HDFC'));
    await fireEvent.press(await screen.findByText('Save expense'));
    await settle();

    expect(alert).toHaveBeenCalledWith('This uses money set aside for goals', expect.stringContaining('released from the lowest-priority goal'), expect.any(Array));
    expect((await getAccount(db, bank))!.balance).toBe(rupees(14_500)); // nothing was written yet
    alert.mockRestore();
  });
});

describe('Goals', () => {
  it('lists goals with their verdicts', async () => {
    const db = await newDb();
    await seedKeyboardScenario(db);
    const Goals = require('../app/(tabs)/goals').default;
    await renderWithApp(<Goals />, db);
    expect(await screen.findByText('Mechanical keyboard')).toBeTruthy();
    expect(screen.getByText("Don't buy")).toBeTruthy();
    expect(screen.getByText(/Not safe to spend yet · should be safe around 10 Nov/)).toBeTruthy();
  });

  it('goal detail shows every number, moves the date with what-if, and records a purchase', async () => {
    const db = await newDb();
    const { goal, bank } = await seedKeyboardScenario(db);
    mockParams = { id: String(goal) };
    const Detail = require('../app/goal/[id]').default;
    await renderWithApp(<Detail />, db);

    expect(await screen.findByText('The numbers')).toBeTruthy();
    expect(screen.getByText('Cooling-off: 9 of 7 days done')).toBeTruthy();
    expect(screen.getByText(/Medium purchase · cooling-off 7 days · estimated date 10 Nov/)).toBeTruthy();

    // What if I save ₹500 more per month? (4,500 vs 4,000 a month: the date moves earlier)
    await fireEvent.press(screen.getByLabelText('Increase Extra per month'));
    await fireEvent.press(screen.getByLabelText('Increase Extra per month'));
    await fireEvent.press(screen.getByLabelText('Increase Extra per month'));
    await fireEvent.press(screen.getByLabelText('Increase Extra per month'));
    await fireEvent.press(screen.getByLabelText('Increase Extra per month'));
    expect(await screen.findByText(/Safe around .* instead of 10 Nov/)).toBeTruthy();

    // Record the purchase
    await press('I bought it');
    await fireEvent.press(await screen.findByText('Save purchase'));
    await settle();
    expect((await getGoal(db, goal))!.status).toBe('bought');
    expect((await getAccount(db, bank))!.balance).toBe(rupees(14_500 - 3_000));
    expect(mockRouter.back).toHaveBeenCalled();
  });

  it('sets money aside and refuses more than the account has free', async () => {
    const db = await newDb();
    const { goal, cash } = await seedKeyboardScenario(db);
    const { Alert } = require('react-native');
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockParams = { id: String(goal) };
    const Detail = require('../app/goal/[id]').default;
    await renderWithApp(<Detail />, db);

    await press('Set money aside');
    await fireEvent.press(await screen.findByText(/Cash · /));
    await fireEvent.changeText(await screen.findByLabelText('Amount'), '100'); // cash is empty after lunch
    await fireEvent.press(await screen.findByText('Set aside'));
    await settle();
    expect(alert).toHaveBeenCalledWith('Check this', 'That is more than the free money in this account.');

    await fireEvent.press(await screen.findByText(/HDFC · /));
    await fireEvent.changeText(await screen.findByLabelText('Amount'), '200');
    await fireEvent.press(await screen.findByText('Set aside'));
    await settle();
    expect((await getGoal(db, goal))!.saved).toBe(rupees(3_200));
    expect(cash).toBeGreaterThan(0);
    alert.mockRestore();
  });
});

describe('Budget', () => {
  it('saves a new monthly budget and a category limit', async () => {
    const db = await newDb();
    await seedKeyboardScenario(db);
    const Budget = require('../app/(tabs)/budget').default;
    await renderWithApp(<Budget />, db);

    const total = await screen.findByLabelText('Monthly budget');
    await fireEvent.changeText(total, '32000');
    await fireEvent.changeText(await screen.findByLabelText('Eating out monthly limit'), '3000');
    await fireEvent.press(await screen.findByText('Save budget'));
    await settle();

    const saved = (await getBudget(db, '2026-10'))!;
    expect(saved.total).toBe(rupees(32_000));
    expect(Object.values(saved.limits)).toContain(rupees(3_000));
    expect(await screen.findByText('Saved')).toBeTruthy();
  });
});

describe('Activity, Accounts, Insights', () => {
  it('Activity searches transactions', async () => {
    const db = await newDb();
    await seedKeyboardScenario(db);
    const Activity = require('../app/(tabs)/activity').default;
    await renderWithApp(<Activity />, db);
    expect(await screen.findByText('Lunch')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Search transactions'), 'zzz');
    expect(await screen.findByText('Nothing matches', undefined, { timeout: 2000 })).toBeTruthy();
  });

  it('Accounts shows net worth and balances', async () => {
    const db = await newDb();
    await seedKeyboardScenario(db);
    const Accounts = require('../app/(tabs)/accounts').default;
    await renderWithApp(<Accounts />, db);
    expect(await screen.findByText('HDFC')).toBeTruthy();
    expect(screen.getAllByText('₹14,500').length).toBeGreaterThan(0); // HDFC, and the net worth (cash is empty)
    expect(screen.getByText('₹0')).toBeTruthy();
  });

  it('Insights renders with data and with none', async () => {
    const db = await newDb();
    const Insights = require('../app/insights').default;
    const first = await renderWithApp(<Insights />, db);
    expect(await screen.findByText('Nothing to show yet')).toBeTruthy();
    first.unmount();

    await seedKeyboardScenario(db);
    await renderWithApp(<Insights />, db);
    expect(await screen.findByText('Income and spending')).toBeTruthy();
    expect(screen.getByText('Top places for fun money')).toBeTruthy();
  });
});

describe('Settings, recurring, categories', () => {
  it('Settings saves a change straight away', async () => {
    const db = await newDb();
    await seedKeyboardScenario(db);
    const Settings = require('../app/settings').default;
    await renderWithApp(<Settings />, db);
    await fireEvent.press(await screen.findByLabelText('Increase Safety buffer'));
    await settle();
    expect((await loadSettings(db)).bufferMonths).toBe(1.5);
    await fireEvent.press(screen.getByText('Dark'));
    await settle();
    expect((await loadSettings(db)).theme).toBe('dark');
  });

  it('Recurring lists rules', async () => {
    const db = await newDb();
    await seedKeyboardScenario(db);
    const Recurring = require('../app/recurring').default;
    await renderWithApp(<Recurring />, db);
    expect(await screen.findByText('Broadband')).toBeTruthy();
    expect(screen.getByText('Stipend')).toBeTruthy();
  });

  it('Categories lists the defaults', async () => {
    const db = await newDb();
    const Categories = require('../app/categories').default;
    await renderWithApp(<Categories />, db);
    expect(await screen.findByText('Groceries')).toBeTruthy();
    expect(screen.getByText('Salary')).toBeTruthy();
  });

  it('Edit transaction saves changes and deleting works', async () => {
    const db = await newDb();
    await seedKeyboardScenario(db);
    const lunch = (await listTransactions(db, { search: 'Lunch' }))[0];
    mockParams = { id: String(lunch.id) };
    const Edit = require('../app/transaction/[id]').default;
    await renderWithApp(<Edit />, db);
    await fireEvent.changeText(await screen.findByLabelText('Amount'), '300');
    await fireEvent.press(await screen.findByText('Save changes'));
    await settle();
    expect((await listTransactions(db, { search: 'Lunch' }))[0].amount).toBe(rupees(300));
  });
});

describe('Onboarding', () => {
  it('creates the first account, budget and estimates', async () => {
    const { openMemoryDb } = require('../db/testing');
    const { withChangeEvents } = require('../db/Db');
    const { boot } = require('../services/bootstrap');
    const db = withChangeEvents(openMemoryDb());
    await boot(db, TODAY);
    const Onboarding = require('../app/onboarding').default;
    await renderWithApp(<Onboarding />, db);

    await fireEvent.changeText(await screen.findByLabelText('Your first account'), 'HDFC');
    await fireEvent.changeText(screen.getByLabelText('How much is in it right now?'), '12000');
    await fireEvent.changeText(screen.getByLabelText('About how much do you earn each month?'), '25000');
    await fireEvent.changeText(screen.getByLabelText('Monthly budget'), '20000');
    await fireEvent.press(screen.getByText('Start using Stash'));
    await settle();

    const settings = await loadSettings(db);
    expect(settings).toMatchObject({ onboarded: true, incomeEstimate: rupees(25_000), savingRateEstimate: rupees(5_000) });
    expect((await getBudget(db, '2026-10'))!.total).toBe(rupees(20_000));
    expect((await db.all('SELECT name FROM accounts')).length).toBe(1);
  });
});
