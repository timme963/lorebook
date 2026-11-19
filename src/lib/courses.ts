import { db, slug, type ChapterRow, type CourseRow } from './db';
import { addXp } from './progress';
import { chapterQuestions, createCardsForChapter } from './srs';
import type { ChapterFile, Question } from './schema';
import { mcCorrect } from './schema';

export async function importChapter(
  file: ChapterFile,
  targetCourseId?: string,
): Promise<{ course: CourseRow; chapter: ChapterRow; replaced: boolean }> {
  return db.transaction('rw', [db.courses, db.chapters, db.cards, db.tombstones], async () => {
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
      // remove cards of questions that no longer exist
      const keep = new Set(chapterQuestions(chapter).map((q) => `${id}:${q.id}`));
      const cards = await db.cards.where('chapterId').equals(id).toArray();
      await db.cards.bulkDelete(cards.filter((c) => !keep.has(c.id)).map((c) => c.id));
      if (chapter.phase === 'done') await createCardsForChapter(chapter);
    }
    return { course, chapter, replaced: !!existing };
  });
}

export async function deleteCourse(courseId: string): Promise<void> {
  await db.transaction(
    'rw',
    [db.courses, db.chapters, db.cards, db.reviews, db.pdfs, db.meta, db.tombstones],
    async () => {
      await db.chapters.where('courseId').equals(courseId).delete();
      await db.cards.where('courseId').equals(courseId).delete();
      await db.reviews.where('courseId').equals(courseId).delete();
      await db.pdfs.delete(courseId);
      await db.meta.delete(`boss:${courseId}`);
      await db.courses.delete(courseId);
    },
  );
}

export async function deleteChapter(chapterId: string): Promise<void> {
  await db.transaction('rw', [db.chapters, db.cards, db.tombstones], async () => {
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

// ---------- Course list: stars and manual order ----------

/** Sort key within a group: unpositioned (new) courses first and newest first, then the manual order. */
function orderKey(c: CourseRow): number {
  return c.position ?? -c.createdAt;
}

/** Starred courses first, then the user's manual order. */
export function sortCourses(courses: readonly CourseRow[]): CourseRow[] {
  return [...courses].sort((a, b) => Number(!!b.starred) - Number(!!a.starred) || orderKey(a) - orderKey(b));
}

/** Course IDs in display order after dropping `activeId` onto `overId`; unchanged across the starred/unstarred boundary. */
export function reorderedIds(courses: readonly CourseRow[], activeId: string, overId: string): string[] {
  const list = sortCourses(courses);
  const from = list.findIndex((c) => c.id === activeId);
  const to = list.findIndex((c) => c.id === overId);
  const moving = list[from];
  const target = list[to];
  // starring decides the group, so dragging cannot move a course into the other group
  if (moving && target && !!moving.starred === !!target.starred) {
    list.splice(from, 1);
    list.splice(to, 0, moving);
  }
  return list.map((c) => c.id);
}

export async function moveCourse(activeId: string, overId: string): Promise<void> {
  await db.transaction('rw', db.courses, async () => {
    const courses = await db.courses.toArray();
    const positions = new Map(courses.map((c) => [c.id, c.position]));
    for (const [position, id] of reorderedIds(courses, activeId, overId).entries()) {
      if (positions.get(id) !== position) await db.courses.update(id, { position });
    }
  });
}

export async function toggleStar(id: string): Promise<void> {
  const course = await db.courses.get(id);
  if (course) await db.courses.update(id, { starred: !course.starred });
}

// ---------- Checking answers ----------

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
  // two rolling rows instead of the full matrix
  let prev: number[] = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row: number[] = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row.push(Math.min((prev[j] ?? 0) + 1, (row[j - 1] ?? 0) + 1, (prev[j - 1] ?? 0) + cost));
    }
    prev = row;
  }
  return prev[b.length] ?? 0;
}

/**
 * Cloze: case, umlauts and small typos (1 per 6 characters) are tolerated.
 * Answers with digits must match exactly (130000 is not 120000); spaces and separators are ignored.
 */
export function checkCloze(given: string, answers: string[]): boolean {
  const g = normalize(given);
  if (!g) return false;
  return answers.some((a) => {
    const n = normalize(a);
    if (n === g) return true;
    if (/\d/.test(n)) return n.replace(/ /g, '') === g.replace(/ /g, '');
    return levenshtein(n, g) <= Math.floor(n.length / 6);
  });
}

export function checkAuto(q: Question, given: string): boolean {
  if (q.type === 'mc') return mcCorrect(q, given);
  if (q.type === 'cloze') return checkCloze(given, q.answers);
  return false;
}

export function scoreOf(answers: Record<string, { score: number }>, questions: Question[]): number {
  if (!questions.length) return 0;
  return questions.reduce((s, q) => s + (answers[q.id]?.score ?? 0), 0) / questions.length;
}

// ---------- Boss fight ----------

export interface BossQuestion {
  chapterId: string;
  chapterTitle: string;
  q: Question;
}

/** Fisher-Yates shuffle into a new array. */
export function shuffle<T>(arr: readonly T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i] as T;
    a[i] = a[j] as T;
    a[j] = tmp;
  }
  return a;
}

/** Mixed questions across all chapters, weighted towards apply/transfer (interleaving). */
export function buildBoss(chapters: ChapterRow[], size = 12): BossQuestion[] {
  const all: BossQuestion[] = chapters.flatMap((ch) =>
    [...ch.content.posttest, ...ch.content.review].map((q) => ({
      chapterId: ch.id,
      chapterTitle: ch.content.title,
      q,
    })),
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
