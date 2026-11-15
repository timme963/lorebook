import { db, slug, type ChapterRow, type CourseRow } from './db';
import { addXp } from './progress';
import { chapterQuestions, createCardsForChapter } from './srs';
import type { ChapterFile, Question } from './schema';

export async function importChapter(file: ChapterFile, targetCourseId?: string): Promise<{ course: CourseRow; chapter: ChapterRow; replaced: boolean }> {
  return db.transaction('rw', db.courses, db.chapters, db.cards, async () => {
    let course: CourseRow | undefined = targetCourseId ? await db.courses.get(targetCourseId) : undefined;
    if (!course) {
      const id = slug(file.course.title);
      course = await db.courses.get(id);
      if (!course) {
        course = { id, title: file.course.title, source: file.course.source, createdAt: Date.now() };
        await db.courses.put(course);
      }
    }

    const id = `${course.id}:${file.chapter.number}`;
    const existing = await db.chapters.get(id);
    const chapter: ChapterRow = {
      id,
      courseId: course.id,
      number: file.chapter.number,
      content: file.chapter,
      verified: file.verified,
      verificationNotes: file.verificationNotes,
      importedAt: Date.now(),
      phase: existing?.phase === 'done' ? 'done' : 'new',
      sceneIndex: 0,
      preAnswers: existing?.phase === 'done' ? existing.preAnswers : {},
      postAnswers: existing?.phase === 'done' ? existing.postAnswers : {},
      preScore: existing?.phase === 'done' ? existing.preScore : undefined,
      postScore: existing?.phase === 'done' ? existing.postScore : undefined,
      completedAt: existing?.completedAt,
    };
    await db.chapters.put(chapter);

    if (existing) {
      // Karten von Fragen, die es nicht mehr gibt, entfernen
      const keep = new Set(chapterQuestions(chapter).map((q) => `${id}:${q.id}`));
      const cards = await db.cards.where('chapterId').equals(id).toArray();
      await db.cards.bulkDelete(cards.filter((c) => !keep.has(c.id)).map((c) => c.id));
      if (chapter.phase === 'done') await createCardsForChapter(chapter);
    }
    return { course, chapter, replaced: !!existing };
  });
}

export async function deleteCourse(courseId: string): Promise<void> {
  await db.transaction('rw', [db.courses, db.chapters, db.cards, db.reviews, db.pdfs, db.meta], async () => {
    await db.chapters.where('courseId').equals(courseId).delete();
    await db.cards.where('courseId').equals(courseId).delete();
    await db.reviews.where('courseId').equals(courseId).delete();
    await db.pdfs.delete(courseId);
    await db.meta.delete(`boss:${courseId}`);
    await db.courses.delete(courseId);
  });
}

export async function deleteChapter(chapterId: string): Promise<void> {
  await db.transaction('rw', db.chapters, db.cards, async () => {
    await db.cards.where('chapterId').equals(chapterId).delete();
    await db.chapters.delete(chapterId);
  });
}

export async function resetChapter(chapterId: string): Promise<void> {
  await db.chapters.update(chapterId, {
    phase: 'new',
    sceneIndex: 0,
    preAnswers: {},
    postAnswers: {},
    preScore: undefined,
    postScore: undefined,
  });
}

export async function completeChapter(ch: ChapterRow): Promise<void> {
  const fresh = (await db.chapters.get(ch.id)) ?? ch;
  const firstTime = !fresh.completedAt;
  await db.chapters.update(ch.id, { phase: 'done', completedAt: fresh.completedAt ?? Date.now() });
  await createCardsForChapter({ ...fresh, phase: 'done' });
  if (firstTime) await addXp(50);
}

// ---------- Antworten prüfen ----------

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

/** Lückentext: Groß/klein, Umlaute und kleine Tippfehler (1 pro 6 Zeichen) werden toleriert. */
export function checkCloze(given: string, answers: string[]): boolean {
  const g = normalize(given);
  if (!g) return false;
  return answers.some((a) => {
    const n = normalize(a);
    return n === g || levenshtein(n, g) <= Math.floor(n.length / 6);
  });
}

export function isAutoGraded(q: Question): boolean {
  return q.type === 'mc' || q.type === 'cloze';
}

export function checkAuto(q: Question, given: string): boolean {
  if (q.type === 'mc') return Number(given) === q.correct;
  if (q.type === 'cloze') return checkCloze(given, q.answers);
  return false;
}

export function scoreOf(answers: Record<string, { score: number }>, questions: Question[]): number {
  if (!questions.length) return 0;
  return questions.reduce((s, q) => s + (answers[q.id]?.score ?? 0), 0) / questions.length;
}

// ---------- Boss-Fight ----------

export interface BossQuestion {
  chapterId: string;
  chapterTitle: string;
  q: Question;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Gemischte Fragen über alle Kapitel, Schwerpunkt Anwendung/Transfer (Interleaving). */
export function buildBoss(chapters: ChapterRow[], size = 12): BossQuestion[] {
  const all: BossQuestion[] = chapters.flatMap((ch) =>
    [...ch.content.posttest, ...ch.content.review].map((q) => ({ chapterId: ch.id, chapterTitle: ch.content.title, q })),
  );
  const deep = shuffle(all.filter((b) => b.q.level === 'apply' || b.q.level === 'transfer'));
  const rest = shuffle(all.filter((b) => b.q.level !== 'apply' && b.q.level !== 'transfer'));
  const picked = [...deep.slice(0, Math.ceil(size * 0.6)), ...rest].slice(0, size);
  return shuffle(picked.length < size ? [...picked, ...deep.slice(Math.ceil(size * 0.6))].slice(0, size) : picked);
}

export interface BossResult {
  best: number;
  last: number;
  at: number;
  attempts: number;
}
