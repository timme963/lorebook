import { getMeta, setMeta } from './db';

export interface Streak {
  count: number;
  lastDay: string | null; // YYYY-MM-DD (lokal)
}

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

/** Sanfte Serie: Ein Tag Pause ist erlaubt, erst bei zwei Tagen Lücke beginnt sie neu. */
export function nextStreak(s: Streak, today: string): Streak {
  if (!s.lastDay) return { count: 1, lastDay: today };
  const gap = daysBetween(s.lastDay, today);
  if (gap <= 0) return s;
  if (gap <= 2) return { count: s.count + 1, lastDay: today };
  return { count: 1, lastDay: today };
}

export function currentStreak(s: Streak, today = dayKey()): number {
  if (!s.lastDay) return 0;
  return daysBetween(s.lastDay, today) <= 2 ? s.count : 0;
}

export async function touchStreak(): Promise<void> {
  const s = await getMeta<Streak>('streak', { count: 0, lastDay: null });
  await setMeta('streak', nextStreak(s, dayKey()));
}

export async function addXp(amount: number): Promise<void> {
  const xp = await getMeta<number>('xp', 0);
  await setMeta('xp', xp + amount);
}

/** Level wächst quadratisch langsamer: Level n braucht 50·(n-1)² XP. */
export function levelFor(xp: number): { level: number; current: number; next: number; progress: number } {
  const level = Math.floor(Math.sqrt(xp / 50)) + 1;
  const current = 50 * (level - 1) ** 2;
  const next = 50 * level ** 2;
  return { level, current, next, progress: (xp - current) / (next - current) };
}

export const LEVEL_TITLES = [
  'Neugierige Seele',
  'Lehrling',
  'Spurenleser',
  'Wissenssammler',
  'Chronist',
  'Gelehrte:r',
  'Meister:in der Archive',
  'Hüter:in des Lorebooks',
];

export function levelTitle(level: number): string {
  return LEVEL_TITLES[Math.min(level - 1, LEVEL_TITLES.length - 1)];
}
