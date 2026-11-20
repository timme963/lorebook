import { db, deviceId, getMeta, setMeta } from './db';
import { getLang } from './i18n';

// XP and study days are stored per device (meta "xp:<device>", "days:<device>") and summed up,
// so two devices never overwrite each other when syncing.

export function dayKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MS_PER_DAY = 86_400_000;

/** Parses a day key (YYYY-MM-DD) into its numeric parts. */
function dayParts(key: string): [number, number, number] {
  const [y = 1970, m = 1, d = 1] = key.split('-').map(Number);
  return [y, m, d];
}

export function daysBetween(a: string, b: string): number {
  const [ya, ma, da] = dayParts(a);
  const [yb, mb, db] = dayParts(b);
  return Math.round((Date.UTC(yb, mb - 1, db) - Date.UTC(ya, ma - 1, da)) / MS_PER_DAY);
}

/** Lenient streak: consecutive study days, with one day off allowed. */
export function streakFromDays(days: Iterable<string>, today = dayKey()): number {
  const sorted = [...new Set(days)]
    .filter((d) => d <= today)
    .sort()
    .reverse();
  const latest = sorted[0];
  if (latest === undefined || daysBetween(latest, today) > 2) return 0;
  let count = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (daysBetween(sorted[i] ?? '', sorted[i - 1] ?? '') > 2) break;
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

/** Migrates old counters (before version 2) to the per-device format once. */
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
        const [y, m, d] = dayParts(s.lastDay);
        const days = Array.from({ length: Math.min(s.count, 400) }, (_, i) => dayKey(new Date(y, m - 1, d - i)));
        const key = `days:${dev}`;
        await setMeta(key, [...new Set([...(await getMeta<string[]>(key, [])), ...days])].sort());
      }
      await db.meta.delete('streak');
    }
  });
}

/** Levels slow down quadratically: level n needs 50·(n-1)² XP. */
export function levelFor(xp: number): { level: number; current: number; next: number; progress: number } {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const current = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, current, next, progress: (xp - current) / (next - current) };
}

const LEVEL_TITLES = {
  de: [
    'Neugierige Seele',
    'Lehrling',
    'Spurenleser',
    'Wissenssammler',
    'Chronist',
    'Gelehrte:r',
    'Meister:in der Archive',
    'Bewahrer:in der Schriften',
    'Runenleser:in',
    'Rätselmeister:in',
    'Kartograf:in des Wissens',
    'Weise:r',
    'Mentor:in',
    'Erzgelehrte:r',
    'Orakel',
    'Erzmagier:in',
    'Großmeister:in',
    'Sternendeuter:in',
    'Lebende Legende',
    'Hüter:in des Lorebooks',
  ],
  en: [
    'Curious soul',
    'Apprentice',
    'Tracker',
    'Knowledge gatherer',
    'Chronicler',
    'Scholar',
    'Master of the archives',
    'Keeper of the scrolls',
    'Rune reader',
    'Riddle master',
    'Cartographer of knowledge',
    'Sage',
    'Mentor',
    'Arch-scholar',
    'Oracle',
    'Archmage',
    'Grandmaster',
    'Star reader',
    'Living legend',
    'Keeper of the Lorebook',
  ],
};

export function levelTitle(level: number): string {
  const titles = LEVEL_TITLES[getLang()];
  return titles[Math.min(level - 1, titles.length - 1)] ?? titles[0] ?? '';
}
