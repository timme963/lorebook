import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_CHAPTER } from './demo';
import { setLang } from './i18n';
import { parseChapterFile } from './importer';
import { fixInvalidEscapes, hasMath, repairMath, splitMath, stripMath } from './math';
import { Rating } from './srs';
import { isDontKnow, isStop, parseChoice, parseChoices, parseRating } from './voiceAnswer';

const BS = '\\';

beforeEach(() => setLang('de'));

describe('Formeln', () => {
  it('erkennt und zerlegt \\( … \\) und \\[ … \\]', () => {
    const s = `Barwert ${BS}(K_0 = ${BS}frac{K_n}{(1+i)^n}${BS}) und ${BS}[x^2${BS}] kosten 5 $`;
    expect(hasMath(s)).toBe(true);
    expect(hasMath('Preis: 5 $ und 10 $')).toBe(false);
    const parts = splitMath(s);
    expect(parts.filter((p) => p.math)).toHaveLength(2);
    expect(stripMath(s)).toContain('K_0 = (K_n)/((1+i)^n)');
  });

  it('repariert einfache Backslashes aus dem Chat', () => {
    // So schreiben Modelle es oft: \( und \frac ohne Verdopplung
    const raw = `{"t": "Zins ${BS}(${BS}frac{a}{b} ${BS}times c${BS})"}`;
    expect(() => JSON.parse(raw)).toThrow();
    const parsed = JSON.parse(fixInvalidEscapes(raw));
    const { value, changed } = repairMath(parsed);
    expect(changed).toBe(true);
    expect(value.t).toBe(`Zins ${BS}(${BS}frac{a}{b} ${BS}times c${BS})`);
  });

  it('importiert ein Kapitel mit unverdoppelten Backslashes und warnt', () => {
    const file = structuredClone(DEMO_CHAPTER);
    file.chapter.objectives[0].text = 'Formel XFORMEL';
    const raw = JSON.stringify(file).replace('XFORMEL', `${BS}(${BS}frac{1}{2}${BS})`); // absichtlich ungültiges JSON-Escape
    const r = parseChapterFile(raw);
    expect(r.ok).toBe(true);
    expect(r.data!.chapter.objectives[0].text).toBe(`Formel ${BS}(${BS}frac{1}{2}${BS})`);
    expect(r.warnings.join(' ')).toMatch(/Backslashes/);
  });
});

describe('Sprachantworten', () => {
  const opts = ['Er sinkt', 'Er steigt, weil das Raten vorbereitet', 'Er bleibt gleich', 'Nur bei Hälfte richtig'];
  it('versteht Buchstaben, Ordinalzahlen und Inhalt', () => {
    expect(parseChoice('B', opts)).toBe(1);
    expect(parseChoice('Antwort be', opts)).toBe(1);
    expect(parseChoice('zeh', opts)).toBe(2);
    expect(parseChoice('die vierte', opts)).toBe(3);
    expect(parseChoice('er steigt weil das raten vorbereitet', opts)).toBe(1);
    expect(parseChoice('the second one', opts)).toBe(1);
    expect(parseChoice('irgendwas anderes ganz', opts)).toBe(-1);
  });
  it('erkennt weiß nicht, stopp und Bewertungen', () => {
    expect(isDontKnow('Weiß ich nicht')).toBe(true);
    expect(isDontKnow("I don't know")).toBe(true);
    expect(isStop('Stopp')).toBe(true);
    expect(isStop('stop please')).toBe(true);
    expect(parseRating('gut')).toBe(Rating.Good);
    expect(parseRating('eher schwer')).toBe(Rating.Hard);
    expect(parseRating('again')).toBe(Rating.Again);
    expect(parseRating('leicht')).toBe(Rating.Easy);
  });
});

describe('Lückentext mit Zahlen', () => {
  it('prüft Zahlen exakt, Wörter mit Tippfehler-Toleranz', async () => {
    const { checkCloze } = await import('./courses');
    expect(checkCloze('130000', ['120000'])).toBe(false);
    expect(checkCloze('120.000', ['120000'])).toBe(true);
    expect(checkCloze('1,5', ['1,5'])).toBe(true);
    expect(checkCloze('Deckungsbeitrg', ['Deckungsbeitrag'])).toBe(true);
  });
});

describe('Änderungs-Listener', () => {
  it('ruft mehrere Empfänger auf (Sync und Erinnerungen)', async () => {
    const { onLocalChange } = await import('./db');
    let a = 0;
    let b = 0;
    const offA = onLocalChange(() => a++);
    const offB = onLocalChange(() => b++);
    expect(typeof offA).toBe('function');
    offA();
    offB();
    expect(a + b).toBe(0);
  });
});

describe('Mehrfachauswahl', () => {
  it('wertet Einfach- und Mehrfachauswahl aus', async () => {
    const { mcCorrect, mcScore, isMulti, ChapterFileSchema } = await import('./schema');
    const single = { correct: 1, options: ['a', 'b', 'c', 'd'] };
    const multi = { correct: [0, 2], options: ['a', 'b', 'c', 'd'] };
    expect(isMulti(single)).toBe(false);
    expect(mcCorrect(single, '1')).toBe(true);
    expect(mcScore(single, '2')).toBe(0);
    expect(mcCorrect(multi, '2,0')).toBe(true);
    expect(mcCorrect(multi, '0')).toBe(false);
    expect(mcScore(multi, '0')).toBe(0.5);
    expect(mcScore(multi, '0,1')).toBe(0);
    expect(mcScore(multi, '0,1,2')).toBe(0.5);
    // Schema: Liste mit ungültigem Index wird abgelehnt
    const file = structuredClone(DEMO_CHAPTER) as any;
    file.chapter.pretest[0].correct = [0, 7];
    expect(ChapterFileSchema.safeParse(file).success).toBe(false);
    file.chapter.pretest[0].correct = [0, 2];
    expect(ChapterFileSchema.safeParse(file).success).toBe(true);
  });
  it('versteht mehrere gesprochene Antworten', () => {
    const opts = ['Karteikarten abfragen', 'Markieren', 'Leeres Blatt', 'Wiederlesen'];
    expect(parseChoices('A und C', opts)).toEqual([0, 2]);
    expect(parseChoices('die erste und die dritte', opts)).toEqual([0, 2]);
    expect(parseChoices('bee and dee', opts)).toEqual([1, 3]);
    expect(parseChoices('blabla nichts', opts)).toEqual([]);
  });
});
