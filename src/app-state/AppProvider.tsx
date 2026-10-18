import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { AppState, Text, View } from 'react-native';
import { getDataVersion, subscribeToChanges, withChangeEvents, type Db } from '../db/Db';
import { openExpoDb } from '../db/expoDb';
import { todayISO, type ISODate } from '../engine/dates';
import { writePrivateFile } from '../platform/files';
import { exportData } from '../services/backup';
import { boot } from '../services/bootstrap';
import { useTheme } from '../theme/ThemeProvider';
import { typography } from '../theme/typography';

export interface AppValue {
  db: Db;
  /** Today's date on the phone's calendar; updates at midnight and when the app comes back to the foreground. */
  today: ISODate;
  /** True until setup is finished. */
  firstRun: boolean;
  /** Re-checks the date and creates any recurring transactions that came due. */
  refresh: () => Promise<void>;
}

export const AppContext = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside <AppProvider>');
  return value;
}

/** Opens the database, runs migrations (with an automatic backup first), and provides it to the app. */
export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready'; db: Db; firstRun: boolean }
  >({ status: 'loading' });
  const [today, setToday] = useState<ISODate>(todayISO());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const raw = await openExpoDb();
        const db = withChangeEvents(raw);
        const result = await boot(db, todayISO(), {
          // An existing database is about to be upgraded: keep a copy of the data first.
          beforeMigrate: async (from) => {
            const data = await exportData(raw);
            writePrivateFile('backups', `before-migration-from-v${from}-${Date.now()}.json`, JSON.stringify(data));
          },
        });
        if (!cancelled) setState({ status: 'ready', db, firstRun: result.firstRun });
      } catch (e) {
        if (!cancelled) setState({ status: 'error', message: e instanceof Error ? e.message : String(e) });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const readyDb = state.status === 'ready' ? state.db : null;
  const refresh = useCallback(async () => {
    if (!readyDb) return;
    const now = todayISO();
    setToday(now);
    await boot(readyDb, now);
  }, [readyDb]);

  // New day or back from the background: re-check the date and create due recurring transactions.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void refresh();
    });
    const timer = setInterval(() => {
      if (todayISO() !== today) void refresh();
    }, 60_000);
    return () => {
      sub.remove();
      clearInterval(timer);
    };
  }, [refresh, today]);

  const value = useMemo<AppValue | null>(
    () => (state.status === 'ready' ? { db: state.db, today, firstRun: state.firstRun, refresh } : null),
    [state, today, refresh],
  );

  if (state.status === 'loading') return null; // the splash screen is still up
  if (state.status === 'error' || !value) return <StartupError message={state.status === 'error' ? state.message : 'Unknown error'} />;
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

function StartupError({ message }: { message: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, padding: 32, justifyContent: 'center', backgroundColor: colors.background, gap: 8 }}>
      <Text style={[typography.headline, { color: colors.textPrimary }]}>Stash could not open its data</Text>
      <Text style={[typography.body, { color: colors.textSecondary }]}>
        Your data has not been changed. Close the app and open it again. If this keeps happening, the message below helps with a fix.
      </Text>
      <Text selectable style={[typography.bodySmall, { color: colors.stopText }]}>{message}</Text>
    </View>
  );
}

/**
 * Runs a read and keeps the result fresh: it reloads whenever any data changes, the date changes,
 * or `deps` change. Old data stays on screen while the new data loads, so lists do not flicker.
 */
export function useQuery<T>(fetcher: (db: Db, today: ISODate) => Promise<T>, deps: React.DependencyList = []) {
  const { db, today } = useApp();
  const version = useSyncExternalStore(subscribeToChanges, getDataVersion);
  const [state, setState] = useState<{ data: T | undefined; error: Error | null; loading: boolean }>({
    data: undefined,
    error: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    fetcher(db, today).then(
      (data) => !cancelled && setState({ data, error: null, loading: false }),
      (error: unknown) => !cancelled && setState((s) => ({ ...s, error: error instanceof Error ? error : new Error(String(error)), loading: false })),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, today, version, ...deps]);

  return state;
}
