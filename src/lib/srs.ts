import { DefaultScheduler, Rating, State, type Grade } from 'ts-fsrs';
import { db, type CardRow, type ChapterRow, type StoredSchedule } from './db';
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
const GRADES: readonly Grade[] = [Rating.Again, Rating.Hard, Rating.Good, Rating.Easy];

// FSRS-6 matches the stability and difficulty values already stored on every card
const scheduler = await DefaultScheduler({
  version: 'FSRS-6',
  desiredRetention: RETENTION,
  maximumInterval: MAX_INTERVAL_DAYS,
  enableFuzz: true,
});

// ---------- conversion between the stored format and the scheduler's format ----------

/** Card type of the FSRS-6 scheduler (the exported default type describes FSRS-7). */
type SchedulerCard = Parameters<typeof scheduler.review>[0]['card'];

const STATUS_BY_STATE = {
  [State.New]: 'new',
  [State.Learning]: 'learning',
  [State.Review]: 'review',
  [State.Relearning]: 'learning',
} as const;

function statusOf(state: number): SchedulerCard['scheduleStatus'] {
  return state === State.Learning || state === State.Review || state === State.Relearning
    ? STATUS_BY_STATE[state]
    : 'new';
}

function stateOf(state: number): State {
  return state === State.Learning || state === State.Review || state === State.Relearning ? state : State.New;
}

/** Date fields may arrive as strings after a backup import or a sync, so they are always revived. */
function toScheduler(stored: StoredSchedule, cardId: string): SchedulerCard {
  return {
    cardId,
    stability: stored.stability,
    difficulty: stored.difficulty,
    state: stateOf(stored.state),
    scheduleStatus: statusOf(stored.state),
    dueAt: new Date(stored.due),
    lastReviewAt: stored.last_review ? new Date(stored.last_review) : null,
    reps: stored.reps,
    lapses: stored.lapses,
    scheduledDays: stored.scheduled_days,
    learningStep: stored.learning_steps,
  };
}

function toStored(card: SchedulerCard, due = card.dueAt): StoredSchedule {
  return {
    due,
    stability: card.stability,
    difficulty: card.difficulty,
    scheduled_days: card.scheduledDays,
    reps: card.reps,
    lapses: card.lapses,
    learning_steps: card.learningStep ?? 0,
    state: card.state,
    last_review: card.lastReviewAt ?? undefined,
  };
}

// ---------- intervals and exam dates ----------

/** Gap in days that FSRS schedules for a review card of this stability (without fuzz), capped like real reviews. */
export function intervalDays(stability: number): number {
  const days = Math.round(scheduler.model.nextInterval({ stability, difficulty: 5 }, RETENTION));
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

async function examDateOf(courseId: string): Promise<string | undefined> {
  return (await db.courses.get(courseId))?.examDate;
}

// ---------- cards ----------

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
      let card = scheduler.newCard({ now, cardId: id });
      let due = card.dueAt;
      // post-test questions were just answered: correct ones come back tomorrow at the earliest, the rest right away
      const answered = ch.postAnswers[q.id];
      if (answered) {
        const correct = answered.score >= 1;
        card = scheduler.review({ card, grade: correct ? Rating.Good : Rating.Again, now }).card;
        const tomorrow = new Date(now.getTime() + DAY_MS);
        due = correct && card.dueAt < tomorrow ? tomorrow : card.dueAt;
      }
      await db.cards.put({
        id,
        courseId: ch.courseId,
        chapterId: ch.id,
        questionId: q.id,
        fsrs: toStored(card, due),
        due: due.getTime(),
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

function formatGap(from: Date, to: Date): string {
  const mins = Math.round((to.getTime() - from.getTime()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} min`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 31) return `${days} ${tr('T', 'd')}`;
  const months = Math.round(days / 30);
  return months < 12 ? `${months} ${tr('Mon', 'mo')}` : `${(days / 365).toFixed(1)} ${tr('J', 'y')}`;
}

/** Preview: when the card comes back for each rating. */
export function previewIntervals(row: CardRow, now = new Date()): Record<Grade, string> {
  const due = new Map<number, Date>();
  for (const item of scheduler.preview({ card: toScheduler(row.fsrs, row.id), now }))
    due.set(item.grade, item.card.dueAt);
  const intervals: Record<Grade, string> = {
    [Rating.Again]: '',
    [Rating.Hard]: '',
    [Rating.Good]: '',
    [Rating.Easy]: '',
  };
  for (const grade of GRADES) intervals[grade] = formatGap(now, due.get(grade) ?? now);
  return intervals;
}

/** Retrievability now (0..1); undefined while the card was never rated. */
export function retrievabilityOf(row: CardRow, now = new Date()): number | undefined {
  const card = toScheduler(row.fsrs, row.id);
  if (!card.lastReviewAt) return undefined;
  const elapsed = Math.max(0, scheduler.chrono.difference(card.lastReviewAt, now));
  return scheduler.model.forgettingCurve(card, elapsed);
}

/** Rates a card and returns it with its new schedule. */
export async function gradeCard(row: CardRow, rating: Grade): Promise<CardRow> {
  const now = new Date();
  const { card } = scheduler.review({ card: toScheduler(row.fsrs, row.id), grade: rating, now });
  const deadline = examDeadline(await examDateOf(row.courseId), now.getTime());
  const due = deadline !== undefined && card.dueAt.getTime() > deadline ? new Date(deadline) : card.dueAt;
  const updated: CardRow = { ...row, fsrs: toStored(card, due), due: due.getTime() };
  await db.transaction('rw', [db.cards, db.reviews, db.meta, db.local], async () => {
    await db.cards.update(row.id, { fsrs: updated.fsrs, due: updated.due });
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
    let target = row.due;
    const lastReview = row.fsrs.last_review ? new Date(row.fsrs.last_review).getTime() : undefined;
    if (row.fsrs.state === State.Review && lastReview !== undefined) {
      target = Math.min(target, lastReview + intervalDays(row.fsrs.stability) * DAY_MS);
    }
    const deadline = deadlines.get(row.courseId);
    if (deadline !== undefined) target = Math.min(target, deadline);
    // tolerance keeps fuzzed due dates from being rewritten (and re-synced) on every start
    if (row.due - target > DAY_MS / 24) {
      await db.cards.update(row.id, { fsrs: { ...row.fsrs, due: new Date(target) }, due: target });
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
