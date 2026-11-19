/** Understands spoken answers in hands-free mode (German and English). */
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
  /(weiss (ich )?(es )?nicht|keine ahnung|ich passe|uberspring|dont know|do not know|no idea|^pass\b|^skip\b|^next\b|^weiter\b)/.test(
    norm(s),
  );

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

/** Which option was named? Letter, ordinal or the option's content. -1 = not understood. */
export function parseChoice(spoken: string, options: string[]): number {
  const words = norm(spoken).split(' ').filter(Boolean);
  if (words.length === 0) return -1;
  // "Antwort B", "B", "Bee": a letter as a word of its own; in longer sentences only the first/last word,
  // otherwise every English "a" would count as an answer
  const candidates = words.length <= 3 ? words : [words.at(-1) ?? '', words[0] ?? ''];
  for (const w of candidates) {
    const i = LETTERS.findIndex((l) => l.includes(w));
    if (i >= 0 && i < options.length) return i;
  }
  for (const w of words) {
    const i = ORDINALS.findIndex((l) => l.includes(w));
    if (i >= 0 && i < options.length) return i;
  }
  // content: largest word overlap with an option
  const said = new Set(words.filter((w) => w.length > 2));
  let best = -1;
  let bestScore = 0;
  options.forEach((o, i) => {
    const ow = norm(o)
      .split(' ')
      .filter((w) => w.length > 2);
    if (!ow.length) return;
    const hit = ow.filter((w) => said.has(w)).length / ow.length;
    if (hit > bestScore) {
      bestScore = hit;
      best = i;
    }
  });
  return bestScore >= 0.5 ? best : -1;
}

/** Self-rating by voice for open questions */
export function parseRating(spoken: string): Grade | undefined {
  const s = norm(spoken);
  if (/\b(nochmal|noch mal|falsch|wieder|again|wrong|nicht gewusst)\b/.test(s)) return Rating.Again;
  if (/\b(schwer|schwierig|hard|teilweise|halb)\b/.test(s)) return Rating.Hard;
  if (/\b(leicht|einfach|easy|perfekt)\b/.test(s)) return Rating.Easy;
  if (/\b(gut|richtig|good|right|correct|ok|okay)\b/.test(s)) return Rating.Good;
  return undefined;
}

const FILLER = new Set([
  'und',
  'and',
  'sowie',
  'plus',
  'komma',
  'oder',
  'antwort',
  'antworten',
  'answer',
  'answers',
  'option',
  'optionen',
  'options',
  'ich',
  'nehme',
  'sage',
  'i',
  'say',
  'pick',
  'choose',
  'auch',
  'also',
  'die',
  'der',
  'the',
  'buchstabe',
  'letter',
]);

/** Multi select: "A und C", "the first and the third" or contents. Empty list = not understood. */
export function parseChoices(spoken: string, options: string[]): number[] {
  const words = norm(spoken).split(' ').filter(Boolean);
  if (words.length === 0) return [];
  const found = new Set<number>();
  let unknown = 0;
  for (const w of words) {
    const li = LETTERS.findIndex((l) => l.includes(w));
    const oi = ORDINALS.findIndex((l) => l.includes(w));
    if (li >= 0 && li < options.length) found.add(li);
    else if (oi >= 0 && oi < options.length) found.add(oi);
    else if (!FILLER.has(w)) unknown++;
  }
  // only letters/ordinals plus filler words → unambiguous
  if (found.size && unknown === 0) return [...found].sort((a, b) => a - b);
  // otherwise contents: every option whose words were mostly said
  const said = new Set(words.filter((w) => w.length > 2));
  const byContent = options
    .map((o, i) => {
      const ow = norm(o)
        .split(' ')
        .filter((w) => w.length > 2);
      return ow.length && ow.filter((w) => said.has(w)).length / ow.length >= 0.5 ? i : -1;
    })
    .filter((i) => i >= 0);
  if (byContent.length) return byContent;
  return found.size ? [...found].sort((a, b) => a - b) : [];
}
