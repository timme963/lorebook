import { useSyncExternalStore } from 'react';

/**
 * Zwei Sprachen, inline übersetzt: tr('Weiter', 'Next').
 * Die Wahl liegt pro Gerät in localStorage (wird nicht synchronisiert). Standard: Browsersprache.
 * App() abonniert die Sprache, dadurch rendert beim Umschalten der ganze Baum neu.
 */
export type Lang = 'de' | 'en';

const KEY = 'lorebook-lang';
const subs = new Set<() => void>();

function initial(): Lang {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'de' || v === 'en') return v;
  } catch {
    /* privater Modus */
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
    /* egal */
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

/** Wird nach jedem Umschalten aufgerufen */
export function onLangChange(fn: () => void): () => void {
  subs.add(fn);
  return () => subs.delete(fn);
}

/** Inline-Übersetzung */
export function tr<T>(de: T, en: T): T {
  return current === 'en' ? en : de;
}

/** Locale für Datums- und Zahlenformat */
export const locale = (): string => (current === 'en' ? 'en-GB' : 'de-DE');

/** Einzahl/Mehrzahl: plural(n, 'Karte', 'Karten', 'card', 'cards') → "3 Karten" */
export function plural(n: number, deOne: string, deMany: string, enOne: string, enMany: string): string {
  return `${n} ${n === 1 ? tr(deOne, enOne) : tr(deMany, enMany)}`;
}
