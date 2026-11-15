import { db, deviceId, getMeta, setMeta } from './db';
import { getLang } from './i18n';

// XP und Lerntage werden pro Gerät gespeichert (meta "xp:<gerät>", "days:<gerät>") und zusammengerechnet.
// So überschreiben sich zwei Geräte beim Sync nie gegenseitig.

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = a.split('-').map(Number);
  const [yb, mb, db] = b.split('-').map(Number);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / 86400000);
}

/** Sanfte Serie: Anzahl Lerntage in Folge, wobei ein Tag Pause erlaubt ist. */
export function streakFromDays(days: Iterable<string>, today = dayKey()): number {
  const sorted = [...new Set(days)].filter((d) => d <= today).sort().reverse();
  if (!sorted.length || daysBetween(sorted[0], today) > 2) return 0;
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i], sorted[i - 1]) > 2) break;
    count++;
  }
  return count;
}

export async function touchStreak(): Promise<void> {
  const key = `days:${await deviceId()}`;
  const days = await getMeta<string[]>(key, []);
  const today = dayKey();
  if (days.includes(today)) return;
  await setMeta(key, [...days, today].sort().slice(-400));
}

export async function addXp(amount: number): Promise<void> {
  const key = `xp:${await deviceId()}`;
  await setMeta(key, (await getMeta<number>(key, 0)) + amount);
}

export async function totalXp(): Promise<number> {
  const rows = await db.meta.where('key').startsWith('xp:').toArray();
  return rows.reduce((s, r) => s + (Number(r.value) || 0), 0);
}

export async function currentStreak(): Promise<number> {
  const rows = await db.meta.where('key').startsWith('days:').toArray();
  return streakFromDays(rows.flatMap((r) => (Array.isArray(r.value) ? (r.value as string[]) : [])));
}

/** Alte Zähler (vor Version 2) einmalig auf das Pro-Gerät-Format umstellen. */
export async function migrateLegacyProgress(): Promise<void> {
  const legacyXp = await db.meta.get('xp');
  const legacyStreak = await db.meta.get('streak');
  if (!legacyXp && !legacyStreak) return;
  const dev = await deviceId();
  await db.transaction('rw', db.meta, db.tombstones, async () => {
    if (legacyXp) {
      const key = `xp:${dev}`;
      await setMeta(key, (await getMeta<number>(key, 0)) + (Number(legacyXp.value) || 0));
      await db.meta.delete('xp');
    }
    if (legacyStreak) {
      const s = legacyStreak.value as { count: number; lastDay: string | null };
      if (s?.lastDay && s.count > 0) {
        const [y, m, d] = s.lastDay.split('-').map(Number);
        const days = Array.from({ length: Math.min(s.count, 400) }, (_, i) => dayKey(new Date(y, m - 1, d - i)));
        const key = `days:${dev}`;
        await setMeta(key, [...new Set([...(await getMeta<string[]>(key, [])), ...days])].sort());
      }
      await db.meta.delete('streak');
    }
  });
}

/** Level wächst quadratisch langsamer: Level n braucht 50·(n-1)² XP. */
export function levelFor(xp: number): { level: number; current: number; next: number; progress: number } {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const current = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, current, next, progress: (xp - current) / (next - current) };
}

const LEVEL_TITLES = {
  de: ['Neugierige Seele', 'Lehrling', 'Spurenleser', 'Wissenssammler', 'Chronist', 'Gelehrte:r', 'Meister:in der Archive', 'Hüter:in des Lorebooks'],
  en: ['Curious soul', 'Apprentice', 'Tracker', 'Knowledge gatherer', 'Chronicler', 'Scholar', 'Master of the archives', 'Keeper of the Lorebook'],
};

export function levelTitle(level: number): string {
  const titles = LEVEL_TITLES[getLang()];
  return titles[Math.min(level - 1, titles.length - 1)];
}
