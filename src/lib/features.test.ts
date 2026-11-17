import { beforeEach, describe, expect, it } from 'vitest';
import { DEMO_CHAPTER } from './demo';
import { setLang } from './i18n';
import { parseChapterFile } from './importer';
import { fixInvalidEscapes, hasMath, repairMath, splitMath, stripMath } from './math';
import { Rating } from './srs';
import { isDontKnow, isStop, parseChoice, parseRating } from './voiceAnswer';

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
