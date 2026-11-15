/**
 * Tägliche Erinnerung an fällige Wiederholungen – nur in der Android-App.
 * Die Benachrichtigungen werden auf dem Gerät für die nächsten 14 Tage geplant (kein Server, geht offline).
 * Für jeden Tag zählt Lorebook, wie viele Karten bis zur Erinnerungszeit fällig sind; Tage ohne fällige Karten werden übersprungen.
 */
import { App as CapApp } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { db, getLocal, onLocalChange, setLocal } from './db';
import { isNative } from './platform';
import { plural, tr } from './i18n';

export interface ReminderSettings {
  enabled: boolean;
  time: string; // HH:MM
}

const KEY = 'reminder';
const BASE_ID = 7000;
const DAYS = 14;
const TEST_ID = 6999;
const ids = () => Array.from({ length: DAYS }, (_, i) => ({ id: BASE_ID + i }));

export const getReminder = () => getLocal<ReminderSettings>(KEY, { enabled: false, time: '18:00' });

function at(time: string, dayOffset: number): Date {
  const [h, m] = time.split(':').map(Number);
  const d = new Date();
  d.setDate(d.getDate() + dayOffset);
  d.setHours(h, m, 0, 0);
  return d;
}

async function plan(s: ReminderSettings): Promise<void> {
  await LocalNotifications.cancel({ notifications: ids() }).catch(() => undefined);
  if (!s.enabled) return;
  const dues = (await db.cards.toArray()).filter((c) => !c.suspended).map((c) => c.due);
  const now = Date.now();
  const notifications = [];
  for (let i = 0; i < DAYS; i++) {
    const when = at(s.time, i);
    if (when.getTime() <= now + 30_000) continue;
    const n = dues.filter((d) => d <= when.getTime()).length;
    if (n === 0) continue;
    notifications.push({
      id: BASE_ID + i,
      title: 'Lorebook',
      body: tr(
        n === 1 ? '1 Karte wartet auf deine Wiederholung.' : `${n} Karten warten auf deine Wiederholung.`,
        `${plural(n, '', '', 'card is', 'cards are')} waiting for review.`,
      ),
      schedule: { at: when, allowWhileIdle: true },
    });
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications });
}

/** Speichert die Einstellung und plant neu. Gibt 'denied' zurück, wenn Benachrichtigungen nicht erlaubt sind. */
export async function setReminder(s: ReminderSettings): Promise<'ok' | 'denied'> {
  if (s.enabled) {
    const perm = await LocalNotifications.requestPermissions();
    if (perm.display !== 'granted') return 'denied';
  }
  await setLocal(KEY, s);
  await plan(s);
  return 'ok';
}

export async function testReminder(): Promise<void> {
  const perm = await LocalNotifications.requestPermissions();
  if (perm.display !== 'granted') throw new Error(tr('Benachrichtigungen sind für Lorebook nicht erlaubt.', 'Notifications are not allowed for Lorebook.'));
  await LocalNotifications.schedule({
    notifications: [{ id: TEST_ID, title: 'Lorebook', body: tr('So sieht deine Erinnerung aus.', 'This is what your reminder looks like.'), schedule: { at: new Date(Date.now() + 3000) } }],
  });
}

async function refresh(): Promise<void> {
  const s = await getReminder();
  if (!s.enabled) return;
  const perm = await LocalNotifications.checkPermissions();
  if (perm.display === 'granted') await plan(s);
}

let timer: ReturnType<typeof setTimeout> | undefined;
function refreshSoon(): void {
  clearTimeout(timer);
  timer = setTimeout(() => void refresh().catch((e) => console.error('[lorebook] Erinnerungen', e)), 5000);
}

/** Beim App-Start: neu planen, bei Rückkehr in die App und nach Änderungen an Karten ebenfalls. */
export function initReminders(): void {
  if (!isNative) return;
  refreshSoon();
  CapApp.addListener('resume', refreshSoon).catch(() => undefined);
  onLocalChange(refreshSoon);
  LocalNotifications.addListener('localNotificationActionPerformed', () => {
    location.hash = '#/review';
  }).catch(() => undefined);
}
