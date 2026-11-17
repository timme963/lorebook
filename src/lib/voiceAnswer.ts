/** Gesprochene Antworten im freihändigen Modus verstehen (Deutsch und Englisch). */
import { Rating, type Grade } from 'ts-fsrs';

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/ß/g, 'ss')
    .replace(/['’]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ß ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isStop = (s: string) => /^(stopp?|stop|beenden|aufhoren|ende|schluss|quit|exit|end)\b/.test(norm(s));

export const isDontKnow = (s: string) =>
  /(weiss (ich )?(es )?nicht|keine ahnung|ich passe|uberspring|dont know|do not know|no idea|^pass\b|^skip\b|^next\b|^weiter\b)/.test(norm(s));

const LETTERS: string[][] = [
  ['a', 'ah', 'aa'],
  ['b', 'be', 'bee', 'beh'],
  ['c', 'ce', 'zeh', 'tse', 'see', 'sea', 'cee'],
  ['d', 'de', 'dee', 'deh'],
];
const ORDINALS: string[][] = [
  ['erste', 'ersten', 'erstes', 'eins', 'first', 'one'],
  ['zweite', 'zweiten', 'zweites', 'zwei', 'second', 'two'],
  ['dritte', 'dritten', 'drittes', 'drei', 'third', 'three'],
  ['vierte', 'vierten', 'viertes', 'vier', 'fourth', 'four'],
];

/** Welche Option wurde genannt? Buchstabe, Ordinalzahl oder Inhalt der Option. -1 = nicht verstanden. */
export function parseChoice(spoken: string, options: string[]): number {
  const words = norm(spoken).split(' ').filter(Boolean);
  if (words.length === 0) return -1;
  // „Antwort B“, „B“, „Bee“ – ein Buchstabe als eigenes Wort, bevorzugt am Anfang oder Ende
  // bei längeren Sätzen nur das erste/letzte Wort (sonst wäre jedes englische „a“ eine Antwort)
  const candidates = words.length <= 3 ? words : [words[words.length - 1], words[0]];
  for (const w of candidates) {
    const i = LETTERS.findIndex((l) => l.includes(w));
    if (i >= 0 && i < options.length) return i;
  }
  for (const w of words) {
    const i = ORDINALS.findIndex((l) => l.includes(w));
    if (i >= 0 && i < options.length) return i;
  }
  // Inhalt: größte Wortüberschneidung mit einer Option
  const said = new Set(words.filter((w) => w.length > 2));
  let best = -1;
  let bestScore = 0;
  options.forEach((o, i) => {
    const ow = norm(o).split(' ').filter((w) => w.length > 2);
    if (!ow.length) return;
    const hit = ow.filter((w) => said.has(w)).length / ow.length;
    if (hit > bestScore) {
      bestScore = hit;
      best = i;
    }
  });
  return bestScore >= 0.5 ? best : -1;
}

/** Selbstbewertung per Stimme bei offenen Fragen */
export function parseRating(spoken: string): Grade | undefined {
  const s = norm(spoken);
  if (/\b(nochmal|noch mal|falsch|wieder|again|wrong|nicht gewusst)\b/.test(s)) return Rating.Again;
  if (/\b(schwer|schwierig|hard|teilweise|halb)\b/.test(s)) return Rating.Hard;
  if (/\b(leicht|einfach|easy|perfekt)\b/.test(s)) return Rating.Easy;
  if (/\b(gut|richtig|good|right|correct|ok|okay)\b/.test(s)) return Rating.Good;
  return undefined;
}
