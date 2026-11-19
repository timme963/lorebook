import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { setLang } from './i18n';
import { looseDemo } from './testFixtures';
import { DEMO_CHAPTER, DEMO_CHAPTER_EN } from './demo';
import { extractJson, parseChapterFile, repairPrompt } from './importer';
import { buildBoss, checkCloze } from './courses';
import { levelFor, streakFromDays } from './progress';
import { generatePrompt, verifyPrompt } from './prompts';
import type { ChapterRow } from './db';

const demoJson = JSON.stringify(DEMO_CHAPTER);

// tests check German texts regardless of the system language (CI runs in English)
beforeEach(() => setLang('de'));
afterAll(() => setLang('de'));

describe('Import', () => {
  it('akzeptiert das Demo-Kapitel ohne Fehler', () => {
    const r = parseChapterFile(demoJson);
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.data?.chapter.posttest.length).toBe(4);
  });

  it('holt JSON aus Chat-Antworten mit Codeblock und Text drumherum', () => {
    const chat = `Hier ist deine Lerneinheit:\n\`\`\`json\n${demoJson}\n\`\`\`\nViel Erfolg!`;
    expect(extractJson(chat)).toBe(demoJson);
    expect(parseChapterFile(chat).ok).toBe(true);
  });

  it('meldet abgeschnittenes JSON verständlich', () => {
    const r = parseChapterFile(demoJson.slice(0, 500));
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toMatch(/Kein gültiges JSON/);
  });

  it('meldet Schemafehler mit Pfad', () => {
    const broken = looseDemo();
    const [first] = broken.chapter.pretest;
    if (first) first.correct = 9;
    delete broken.chapter.story.ending;
    const r = parseChapterFile(JSON.stringify(broken));
    expect(r.ok).toBe(false);
    expect(r.errors.some((e) => e.startsWith('chapter.pretest[0].correct'))).toBe(true);
    expect(r.errors.some((e) => e.startsWith('chapter.story.ending'))).toBe(true);
    expect(repairPrompt(r.errors)).toContain('chapter.story.ending');
  });

  it('erkennt Verweise auf unbekannte Lernziele und doppelte IDs', () => {
    const broken = looseDemo();
    const [post] = broken.chapter.posttest;
    const [review] = broken.chapter.review;
    if (post) post.objective = 'o99';
    if (review) review.id = 'q1';
    const r = parseChapterFile(JSON.stringify(broken));
    expect(r.ok).toBe(false);
    expect(r.errors.join('\n')).toMatch(/o99/);
    expect(r.errors.join('\n')).toMatch(/doppelt/);
  });

  it('warnt bei ungeprüften Inhalten', () => {
    const r = parseChapterFile(JSON.stringify({ ...DEMO_CHAPTER, verified: false }));
    expect(r.ok).toBe(true);
    expect(r.warnings.join()).toMatch(/Prompt B/);
  });
});

describe('Antworten', () => {
  it('toleriert Groß/klein, Umlaute und kleine Tippfehler', () => {
    expect(checkCloze('Größer', ['größer'])).toBe(true);
    expect(checkCloze('groesser', ['größer'])).toBe(true);
    expect(checkCloze('pretestin', ['Pretesting'])).toBe(true);
    expect(checkCloze('kleiner', ['größer'])).toBe(false);
    expect(checkCloze('', ['x'])).toBe(false);
  });
});

describe('Fortschritt', () => {
  it('Serie verzeiht einen Tag Pause', () => {
    const days = ['2026-11-01', '2026-11-02', '2026-11-04'];
    expect(streakFromDays(days, '2026-11-04')).toBe(3);
    expect(streakFromDays(days, '2026-11-06')).toBe(3);
    expect(streakFromDays(days, '2026-11-07')).toBe(0);
    expect(streakFromDays([...days, '2026-11-08'], '2026-11-08')).toBe(1);
    // study days of two devices are merged
    expect(streakFromDays(['2026-11-01', '2026-11-03', '2026-11-03', '2026-11-04'], '2026-11-04')).toBe(3);
  });

  it('Level-Kurve', () => {
    expect(levelFor(0).level).toBe(1);
    expect(levelFor(50).level).toBe(2);
    expect(levelFor(199).level).toBe(2);
    expect(levelFor(200).level).toBe(3);
  });
});

describe('Boss-Fight', () => {
  it('mischt Fragen mit Schwerpunkt Anwendung/Transfer', () => {
    const ch: ChapterRow = {
      id: 'd:1',
      courseId: 'd',
      number: 1,
      content: DEMO_CHAPTER.chapter,
      verified: true,
      verificationNotes: [],
      importedAt: 0,
      phase: 'done',
      sceneIndex: 0,
      preAnswers: {},
      postAnswers: {},
    };
    const boss = buildBoss([ch], 6);
    expect(boss).toHaveLength(6);
    const deep = boss.filter((b) => b.q.level === 'apply' || b.q.level === 'transfer').length;
    expect(deep).toBeGreaterThanOrEqual(4);
    expect(new Set(boss.map((b) => b.q.id)).size).toBe(6);
  });
});

describe('Prompts', () => {
  it('setzen Kapitelangaben ein', () => {
    const p = generatePrompt({ course: 'BWL', chapterNumber: '3', chapterTitle: 'Kosten', style: 'Krimi' });
    expect(p).toContain('KAPITEL: 3 – Kosten');
    expect(p).toContain('STORY-STIL: Krimi');
    expect(verifyPrompt()).toContain('"verified" auf true');
  });
});

describe('Englisch', () => {
  it('liefert englische Prompts, Meldungen und ein gültiges Demo-Kapitel', () => {
    setLang('en');
    const p = generatePrompt({ course: 'Econ', chapterNumber: '2', chapterTitle: 'Costs', style: '' });
    expect(p).toContain('CHAPTER: 2 – Costs');
    expect(p).toContain('STORY STYLE: Choose the genre');
    expect(parseChapterFile('{"lorebook": 1, "course": {').errors[0]).toMatch(/Not valid JSON/);
    const r = parseChapterFile(JSON.stringify(DEMO_CHAPTER_EN));
    expect(r.errors).toEqual([]);
    expect(r.ok).toBe(true);
  });
});
