/**
 * How well is each objective retained? Based on the FSRS retrievability of its cards:
 * the estimated chance of knowing the answer right now.
 */
import { db, type CardRow, type ChapterRow } from './db';
import { chapterQuestions, retrievabilityOf } from './srs';

export interface ObjectiveStat {
  key: string; // `${chapterId}:${objectiveId}`
  chapterId: string;
  chapterNumber: number;
  objectiveId: string;
  text: string;
  cards: number;
  /** Cards rated at least once */
  reviewed: number;
  /** Mean retrievability 0..1 (rated cards only) */
  retention?: number;
  /** How often cards of this objective were forgotten */
  lapses: number;
}

function objectiveOf(ch: ChapterRow, questionId: string): string | undefined {
  return chapterQuestions(ch).find((q) => q.id === questionId)?.objective;
}

export async function objectiveStats(courseId: string, now = new Date()): Promise<ObjectiveStat[]> {
  const [chapters, cards] = await Promise.all([
    db.chapters.where('courseId').equals(courseId).sortBy('number'),
    db.cards.where('courseId').equals(courseId).toArray(),
  ]);
  const stats = new Map<string, ObjectiveStat & { sum: number }>();
  for (const ch of chapters) {
    if (ch.phase !== 'done') continue;
    for (const o of ch.content.objectives) {
      const key = `${ch.id}:${o.id}`;
      stats.set(key, {
        key,
        chapterId: ch.id,
        chapterNumber: ch.number,
        objectiveId: o.id,
        text: o.text,
        cards: 0,
        reviewed: 0,
        lapses: 0,
        sum: 0,
      });
    }
  }
  const byId = new Map(chapters.map((c) => [c.id, c]));
  for (const card of cards) {
    if (card.suspended) continue;
    const ch = byId.get(card.chapterId);
    const oid = ch && objectiveOf(ch, card.questionId);
    const s = oid && stats.get(`${card.chapterId}:${oid}`);
    if (!s) continue;
    s.cards++;
    s.lapses += card.fsrs.lapses ?? 0;
    const r = retrievabilityOf(card, now);
    if (r !== undefined) {
      s.reviewed++;
      s.sum += r;
    }
  }
  return [...stats.values()]
    .map(({ sum, ...s }) => ({ ...s, retention: s.reviewed ? sum / s.reviewed : undefined }))
    .sort((a, b) => (a.retention ?? 2) - (b.retention ?? 2) || b.lapses - a.lapses);
}

/** Objectives worth training: below 90 % retrievability (weakest first). */
export function weakObjectives(stats: ObjectiveStat[]): ObjectiveStat[] {
  return stats.filter((s) => s.retention !== undefined && s.retention < 0.9);
}

/** Cards for weak-spot training: from the weakest objectives, least certain first, at most 20. */
export async function weakCards(courseId: string, max = 20): Promise<CardRow[]> {
  const now = new Date();
  const weak = new Set(weakObjectives(await objectiveStats(courseId, now)).map((s) => s.key));
  if (weak.size === 0) return [];
  const chapters = new Map((await db.chapters.where('courseId').equals(courseId).toArray()).map((c) => [c.id, c]));
  const cards = (await db.cards.where('courseId').equals(courseId).toArray()).filter((c) => {
    if (c.suspended) return false;
    const ch = chapters.get(c.chapterId);
    const oid = ch && objectiveOf(ch, c.questionId);
    return !!oid && weak.has(`${c.chapterId}:${oid}`);
  });
  return cards
    .map((c) => ({ c, r: retrievabilityOf(c, now) ?? 0 }))
    .sort((a, b) => a.r - b.r)
    .slice(0, max)
    .map(({ c }) => c);
}
