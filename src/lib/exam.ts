/** Mock exam: questions from all completed chapters, a time limit, no feedback until it is handed in. */
import { checkCloze, shuffle } from './courses';
import { db, getMeta, setMeta, type ChapterRow } from './db';
import { addXp } from './progress';
import { mcScore, type Question } from './schema';

export interface ExamQuestion {
  chapterId: string;
  chapterTitle: string;
  q: Question;
}

/** Exam lengths offered before the start, in questions. */
export const EXAM_SIZES = [10, 20, 30] as const;

/** Time allowed per question, in minutes: open questions need writing time. */
const MINUTES_PER_QUESTION: Record<Question['type'], number> = { mc: 1.5, cloze: 1.5, open: 4 };

/** Share of apply/transfer questions, which come closest to what an exam asks. */
const DEEP_SHARE = 0.6;

/** German grading scale: lowest percentage for each grade; below the last entry the exam is failed (5,0). */
const GRADE_SCALE: readonly [number, string][] = [
  [0.95, '1,0'],
  [0.9, '1,3'],
  [0.85, '1,7'],
  [0.8, '2,0'],
  [0.75, '2,3'],
  [0.7, '2,7'],
  [0.65, '3,0'],
  [0.6, '3,3'],
  [0.55, '3,7'],
  [0.5, '4,0'],
];
export const PASS_MARK = 0.5;
const FAILED_GRADE = '5,0';

/** XP for an attempt scale with the result; passing for the first time earns a bonus. */
const XP_PER_FULL_SCORE = 30;
const FIRST_PASS_XP = 100;

export interface ExamResult {
  best: number;
  last: number;
  at: number;
  attempts: number;
}

/** Mixed questions across the completed chapters, weighted towards apply/transfer (interleaving). */
export function buildExam(chapters: readonly ChapterRow[], size: number): ExamQuestion[] {
  const all: ExamQuestion[] = chapters
    .filter((ch) => ch.phase === 'done')
    .flatMap((ch) =>
      [...ch.content.posttest, ...ch.content.review].map((q) => ({
        chapterId: ch.id,
        chapterTitle: ch.content.title,
        q,
      })),
    );
  const isDeep = (e: ExamQuestion) => e.q.level === 'apply' || e.q.level === 'transfer';
  const deep = shuffle(all.filter(isDeep));
  const rest = shuffle(all.filter((e) => !isDeep(e)));
  const deepCount = Math.min(deep.length, Math.ceil(size * DEEP_SHARE));
  const picked = [...deep.slice(0, deepCount), ...rest, ...deep.slice(deepCount)].slice(0, size);
  return shuffle(picked);
}

export function timeLimitMinutes(questions: readonly ExamQuestion[]): number {
  return Math.ceil(questions.reduce((sum, e) => sum + MINUTES_PER_QUESTION[e.q.type], 0));
}

/** Score 0..1 of an automatically graded answer; open questions are graded by the student afterwards. */
export function autoScore(q: Question, given: string): number | undefined {
  if (q.type === 'mc') return mcScore(q, given);
  if (q.type === 'cloze') return checkCloze(given, q.answers) ? 1 : 0;
  return undefined;
}

export function gradeFor(share: number): string {
  return GRADE_SCALE.find(([min]) => share >= min)?.[1] ?? FAILED_GRADE;
}

export function examResultKey(courseId: string): string {
  return `exam:${courseId}`;
}

/** Key under which installs that predate the mock exam keep their best result. */
export function legacyResultKey(courseId: string): string {
  return `boss:${courseId}`;
}

export async function loadExamResult(courseId: string): Promise<ExamResult | null> {
  return (
    (await getMeta<ExamResult | null>(examResultKey(courseId), null)) ??
    getMeta<ExamResult | null>(legacyResultKey(courseId), null)
  );
}

/**
 * Stores the result, awards XP and puts every question that was not fully right into the next review,
 * so the gaps the exam revealed get practised. Returns the XP and whether this is a new best.
 */
export async function finishExam(
  courseId: string,
  questions: readonly ExamQuestion[],
  scores: readonly number[],
): Promise<{ xp: number; best: boolean }> {
  const total = scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length);
  const prev = await loadExamResult(courseId);
  const firstPass = total >= PASS_MARK && (!prev || prev.best < PASS_MARK);
  const xp = Math.round(total * XP_PER_FULL_SCORE) + (firstPass ? FIRST_PASS_XP : 0);
  await setMeta(examResultKey(courseId), {
    best: Math.max(total, prev?.best ?? 0),
    last: total,
    at: Date.now(),
    attempts: (prev?.attempts ?? 0) + 1,
  } satisfies ExamResult);
  await addXp(xp);
  const now = Date.now();
  const missed = questions.filter((_, i) => (scores[i] ?? 0) < 1).map((e) => `${e.chapterId}:${e.q.id}`);
  await db.transaction('rw', db.cards, async () => {
    for (const card of await db.cards.bulkGet(missed)) {
      if (card && !card.suspended && card.due > now) {
        await db.cards.update(card.id, { due: now, fsrs: { ...card.fsrs, due: new Date(now) } });
      }
    }
  });
  return { xp, best: !prev || total > prev.best };
}
