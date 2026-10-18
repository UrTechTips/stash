import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { parseISO } from '../engine/dates';
import type { PlannedReminder } from '../services/reminders';

const CHANNEL = 'stash-reminders';

/** Show reminders as banners even while the app is open. Call once at startup. */
export function setupNotifications(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
  });
}

async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/**
 * Replaces every scheduled notification with the given plan (9 am local time on each date), plus an
 * optional weekly backup reminder on Sunday morning. Returns false if the user denied permission.
 */
export async function applyReminders(plan: PlannedReminder[], opts: { weeklyBackup: boolean }): Promise<boolean> {
  if (plan.length === 0 && !opts.weeklyBackup) {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return true;
  }
  if (!(await ensurePermission())) return false;
  await Notifications.cancelAllScheduledNotificationsAsync();

  const now = Date.now();
  for (const r of plan) {
    const { y, m, d } = parseISO(r.date);
    const when = new Date(y, m - 1, d, 9, 0, 0);
    if (when.getTime() <= now) continue;
    await Notifications.scheduleNotificationAsync({
      identifier: r.id,
      content: { title: r.title, body: r.body },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: when, channelId: CHANNEL },
    });
  }
  if (opts.weeklyBackup) {
    await Notifications.scheduleNotificationAsync({
      identifier: 'weekly-backup',
      content: { title: 'Back up your Stash data', body: 'Settings > Export backup takes a few seconds.' },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: 1, hour: 10, minute: 0, channelId: CHANNEL },
    });
  }
  return true;
}
