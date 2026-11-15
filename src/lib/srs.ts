import { createEmptyCard, fsrs, generatorParameters, Rating, type Card, type Grade } from 'ts-fsrs';
import { db, type CardRow, type ChapterRow } from './db';
import { addXp, touchStreak } from './progress';
import type { Question } from './schema';

export { Rating };
export type { Grade };

const scheduler = fsrs(generatorParameters({ enable_fuzz: true, request_retention: 0.9 }));

/** Dexie liefert Datumsfelder als Date zurück – sicherheitshalber normalisieren (z. B. nach Backup-Import). */
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

/** Legt nach Kapitelabschluss für alle Fragen Karten an (bestehende bleiben unverändert). */
export async function createCardsForChapter(ch: ChapterRow): Promise<number> {
  const now = new Date();
  let created = 0;
  await db.transaction('rw', db.cards, async () => {
    for (const q of chapterQuestions(ch)) {
      const id = `${ch.id}:${q.id}`;
      if (await db.cards.get(id)) continue;
      const card = createEmptyCard(now);
      // Fragen aus dem Nachtest sind gerade beantwortet → erst morgen fällig, Rest sofort
      const answered = ch.postAnswers[q.id];
      let fsrsCard = card;
      if (answered) {
        fsrsCard = scheduler.next(card, now, answered.score >= 1 ? Rating.Good : Rating.Again).card;
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
  return rows
    .filter((r) => !r.suspended && (!courseId || r.courseId === courseId))
    .sort((a, b) => a.due - b.due);
}

export async function countDue(courseId?: string): Promise<number> {
  return (await dueCards(courseId)).length;
}

/** Vorschau: in wie vielen Tagen die Karte bei jeder Bewertung wieder kommt. */
export function previewIntervals(row: CardRow, now = new Date()): Record<Grade, string> {
  const rec = scheduler.repeat(reviveCard(row.fsrs), now);
  const fmt = (d: Date) => {
    const mins = Math.round((d.getTime() - now.getTime()) / 60000);
    if (mins < 60) return `${Math.max(1, mins)} min`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return `${hours} h`;
    const days = Math.round(hours / 24);
    if (days < 31) return `${days} T`;
    const months = Math.round(days / 30);
    return months < 12 ? `${months} Mon` : `${(days / 365).toFixed(1)} J`;
  };
  return {
    [Rating.Again]: fmt(rec[Rating.Again].card.due),
    [Rating.Hard]: fmt(rec[Rating.Hard].card.due),
    [Rating.Good]: fmt(rec[Rating.Good].card.due),
    [Rating.Easy]: fmt(rec[Rating.Easy].card.due),
  } as Record<Grade, string>;
}

export async function gradeCard(row: CardRow, rating: Grade): Promise<void> {
  const now = new Date();
  const { card } = scheduler.next(reviveCard(row.fsrs), now, rating);
  await db.transaction('rw', db.cards, db.reviews, db.meta, async () => {
    await db.cards.update(row.id, { fsrs: card, due: new Date(card.due).getTime() });
    await db.reviews.add({ cardId: row.id, courseId: row.courseId, rating, at: now.getTime() });
    await addXp(rating === Rating.Again ? 4 : 10);
    await touchStreak();
  });
}

export async function flagCard(row: CardRow, reason: string): Promise<void> {
  await db.cards.update(row.id, { suspended: true, flagged: reason || 'gemeldet' });
}

export async function unflagCard(id: string): Promise<void> {
  await db.cards.update(id, { suspended: false, flagged: undefined });
}
