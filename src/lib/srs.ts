import { createEmptyCard, fsrs, generatorParameters, Rating, State, type Card, type Grade } from 'ts-fsrs';
import { db, type CardRow, type ChapterRow } from './db';
import { addXp, touchStreak } from './progress';
import type { Question } from './schema';
import { tr } from './i18n';

export { Rating };
export type { Grade };

/** Target chance of still knowing an answer when it comes up again. */
const RETENTION = 0.93;
/** A study app works towards exams within a semester, so no gap grows beyond this. */
const MAX_INTERVAL_DAYS = 90;
/** Every card comes up once more at least this many days before a course's exam (1 day if that is too late). */
const EXAM_LEAD_DAYS = 2;
const DAY_MS = 86_400_000;

const scheduler = fsrs(
  generatorParameters({ enable_fuzz: true, request_retention: RETENTION, maximum_interval: MAX_INTERVAL_DAYS }),
);

// FSRS-6 forgetting curve R(t) = (1 + FACTOR * t / S) ^ DECAY, solved for t at the target retention
const DECAY = -(scheduler.parameters.w[20] ?? 0.1542);
const FACTOR = 0.9 ** (1 / DECAY) - 1;

/** Gap in days that FSRS would schedule for a review card of this stability (without fuzz). */
export function intervalDays(stability: number): number {
  const days = Math.round((stability / FACTOR) * (RETENTION ** (1 / DECAY) - 1));
  return Math.min(MAX_INTERVAL_DAYS, Math.max(1, days));
}

/** Latest due time that still leaves a review before the exam; undefined without an exam or when it is too close. */
export function examDeadline(examDate: string | undefined, now: number): number | undefined {
  if (!examDate) return undefined;
  const examDay = new Date(`${examDate}T00:00:00`).getTime();
  for (const lead of [EXAM_LEAD_DAYS, 1]) {
    const deadline = examDay - lead * DAY_MS;
    if (deadline > now) return deadline;
  }
  return undefined;
}

/** The card with a different due time. */
function withDue(card: Card, due: number): Card {
  return { ...card, due: new Date(due) };
}

async function examDateOf(courseId: string): Promise<string | undefined> {
  return (await db.courses.get(courseId))?.examDate;
}

/** Normalises date fields to Date, which they may not be after a backup import. */
function reviveCard(c: Card): Card {
  return {
    ...c,
    due: new Date(c.due),
    last_review: c.last_review ? new Date(c.last_review) : undefined,
  };
}

export function chapterQuestions(ch: ChapterRow): Question[] {
  const c = ch.content;
  return [...c.pretest, ...c.posttest, ...c.review];
}

/** Creates cards for all questions after a chapter is completed (existing ones stay unchanged). */
export async function createCardsForChapter(ch: ChapterRow): Promise<number> {
  const now = new Date();
  let created = 0;
  await db.transaction('rw', db.cards, async () => {
    for (const q of chapterQuestions(ch)) {
      const id = `${ch.id}:${q.id}`;
      if (await db.cards.get(id)) continue;
      const card = createEmptyCard(now);
      // post-test questions were just answered: correct ones come back tomorrow at the earliest, the rest right away
      const answered = ch.postAnswers[q.id];
      let fsrsCard = card;
      if (answered) {
        const correct = answered.score >= 1;
        fsrsCard = scheduler.next(card, now, correct ? Rating.Good : Rating.Again).card;
        const tomorrow = now.getTime() + DAY_MS;
        if (correct && new Date(fsrsCard.due).getTime() < tomorrow) fsrsCard = withDue(fsrsCard, tomorrow);
      }
      await db.cards.put({
        id,
        courseId: ch.courseId,
        chapterId: ch.id,
        questionId: q.id,
        fsrs: fsrsCard,
        due: new Date(fsrsCard.due).getTime(),
        suspended: false,
      });
      created++;
    }
  });
  return created;
}

export async function dueCards(courseId?: string, now = Date.now()): Promise<CardRow[]> {
  const rows = await db.cards.where('due').belowOrEqual(now).toArray();
  return rows.filter((r) => !r.suspended && (!courseId || r.courseId === courseId)).sort((a, b) => a.due - b.due);
}

export async function countDue(courseId?: string): Promise<number> {
  return (await dueCards(courseId)).length;
}

/** Preview: when the card comes back for each rating. */
export function previewIntervals(row: CardRow, now = new Date()): Record<Grade, string> {
  const rec = scheduler.repeat(reviveCard(row.fsrs), now);
  const fmt = (d: Date) => {
    const mins = Math.round((d.getTime() - now.getTime()) / 60000);
    if (mins < 60) return `${Math.max(1, mins)} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.round(hours / 24);
    if (days < 31) return `${days} ${tr('T', 'd')}`;
    const months = Math.round(days / 30);
    return months < 12 ? `${months} ${tr('Mon', 'mo')}` : `${(days / 365).toFixed(1)} ${tr('J', 'y')}`;
  };
  const intervals: Record<Grade, string> = {
    [Rating.Again]: fmt(rec[Rating.Again].card.due),
    [Rating.Hard]: fmt(rec[Rating.Hard].card.due),
    [Rating.Good]: fmt(rec[Rating.Good].card.due),
    [Rating.Easy]: fmt(rec[Rating.Easy].card.due),
  };
  return intervals;
}

/** Retrievability now (0..1); undefined while the card was never rated. */
export function retrievabilityOf(row: CardRow, now = new Date()): number | undefined {
  if (!row.fsrs.last_review) return undefined;
  return scheduler.retrievability(reviveCard(row.fsrs), now);
}

/** Rates a card and returns it with its new schedule. */
export async function gradeCard(row: CardRow, rating: Grade): Promise<CardRow> {
  const now = new Date();
  let { card } = scheduler.next(reviveCard(row.fsrs), now, rating);
  const deadline = examDeadline(await examDateOf(row.courseId), now.getTime());
  if (deadline !== undefined && new Date(card.due).getTime() > deadline) card = withDue(card, deadline);
  const updated: CardRow = { ...row, fsrs: card, due: new Date(card.due).getTime() };
  await db.transaction('rw', [db.cards, db.reviews, db.meta, db.local], async () => {
    await db.cards.update(row.id, { fsrs: card, due: updated.due });
    await db.reviews.add({ cardId: row.id, courseId: row.courseId, rating, at: now.getTime() });
    await addXp(rating === Rating.Again ? 4 : 10);
    await touchStreak();
  });
  return updated;
}

/**
 * Brings existing schedules in line with the current rules: shortens gaps planned under older, longer settings
 * and pulls cards forward so they come up before the exam. Only ever moves due dates earlier, so it is safe to
 * run on every start and after an exam date changes.
 */
export async function retuneSchedules(courseId?: string, now = Date.now()): Promise<number> {
  const courses = await db.courses.toArray();
  const deadlines = new Map(courses.map((c) => [c.id, examDeadline(c.examDate, now)]));
  const cards = courseId ? await db.cards.where('courseId').equals(courseId).toArray() : await db.cards.toArray();
  let changed = 0;
  for (const row of cards) {
    const card = reviveCard(row.fsrs);
    let target = row.due;
    if (card.state === State.Review && card.last_review) {
      target = Math.min(target, card.last_review.getTime() + intervalDays(card.stability) * DAY_MS);
    }
    const deadline = deadlines.get(row.courseId);
    if (deadline !== undefined) target = Math.min(target, deadline);
    // tolerance keeps fuzzed due dates from being rewritten (and re-synced) on every start
    if (row.due - target > DAY_MS / 24) {
      await db.cards.update(row.id, { fsrs: withDue(card, target), due: target });
      changed++;
    }
  }
  return changed;
}

export async function flagCard(row: CardRow, reason: string): Promise<void> {
  await db.cards.update(row.id, { suspended: true, flagged: reason || 'gemeldet' });
}

export async function unflagCard(id: string): Promise<void> {
  await db.cards.update(id, { suspended: false, flagged: undefined });
}
