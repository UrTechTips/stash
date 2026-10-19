import { useEffect } from 'react';
import { loadSettings } from '../db/settings';
import { applyReminders } from '../platform/notifications';
import { loadContext } from '../services/context';
import { planReminders } from '../services/reminders';
import { useQuery } from './AppProvider';


export function useReminderSync(): void {
  const { data } = useQuery(async (db, today) => {
    const settings = await loadSettings(db);
    if (!settings.billReminders && !settings.goalReminders && !settings.backupReminder) return { plan: [], backup: false, key: 'off' };
    const ctx = await loadContext(db, today);
    const plan = await planReminders(db, ctx, { bills: settings.billReminders, goals: settings.goalReminders });
    return { plan, backup: settings.backupReminder, key: JSON.stringify([plan, settings.backupReminder]) };
  });

  const key = data?.key;
  useEffect(() => {
    if (!data) return;
    applyReminders(data.plan, { weeklyBackup: data.backup }).catch(() => {
      // Notifications are a nicety; never let a scheduling problem break the app.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
}
