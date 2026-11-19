import { useSyncExternalStore } from 'react';

/**
 * Two languages, translated inline: tr('Weiter', 'Next').
 * The choice is stored per device in localStorage (not synced). Default: browser language.
 * App() subscribes to the language, so the whole tree re-renders on a switch.
 */
export type Lang = 'de' | 'en';

const KEY = 'lorebook-lang';
const subs = new Set<() => void>();

function initial(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'de' || v === 'en') return v;
  } catch {
    /* private mode */
  }
  return (navigator.language || 'de').toLowerCase().startsWith('de') ? 'de' : 'en';
}

let current: Lang = initial();
if (typeof document !== 'undefined') document.documentElement.lang = current;

export const getLang = (): Lang => current;

export function setLang(l: Lang): void {
  current = l;
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* not critical */
  }
  if (typeof document !== 'undefined') document.documentElement.lang = l;
  subs.forEach((f) => f());
}

export function useLang(): Lang {
  return useSyncExternalStore(
    (f) => {
      subs.add(f);
      return () => subs.delete(f);
    },
    getLang,
    getLang,
  );
}

/** Called after every language switch */
export function onLangChange(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Inline translation */
export function tr<T>(de: T, en: T): T {
  return current === 'en' ? en : de;
}

/** Locale for date and number formatting */
export const locale = (): string => (current === 'en' ? 'en-GB' : 'de-DE');

/** Singular/plural: plural(n, 'Karte', 'Karten', 'card', 'cards') → "3 Karten" */
export function plural(n: number, deOne: string, deMany: string, enOne: string, enMany: string): string {
  return `${n} ${n === 1 ? tr(deOne, enOne) : tr(deMany, enMany)}`;
}
