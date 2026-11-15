import Dexie, { type EntityTable } from 'dexie';
import type { Card } from 'ts-fsrs';
import type { ChapterContent } from './schema';

export interface CourseRow {
  id: string;
  title: string;
  source?: string;
  createdAt: number;
  examDate?: string; // YYYY-MM-DD
}

export type ChapterPhase = 'new' | 'pretest' | 'story' | 'posttest' | 'done';

export interface ChapterRow {
  id: string; // `${courseId}:${number}`
  courseId: string;
  number: number;
  content: ChapterContent;
  verified: boolean;
  verificationNotes: string[];
  importedAt: number;
  phase: ChapterPhase;
  sceneIndex: number;
  preAnswers: Record<string, AnswerRecord>;
  postAnswers: Record<string, AnswerRecord>;
  preScore?: number; // 0..1
  postScore?: number; // 0..1
  completedAt?: number;
}

export interface AnswerRecord {
  given: string;
  correct: boolean | null; // null = selbst bewertet offen
  score: number; // 0..1
}

export interface CardRow {
  id: string; // `${chapterId}:${questionId}`
  courseId: string;
  chapterId: string;
  questionId: string;
  fsrs: Card;
  due: number; // ms – für Index
  suspended: boolean;
  flagged?: string;
}

export interface ReviewLogRow {
  id?: number;
  cardId: string;
  courseId: string;
  rating: number;
  at: number;
}

export interface PdfRow {
  courseId: string;
  name: string;
  blob: Blob;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export const db = new Dexie('lorebook') as Dexie & {
  courses: EntityTable<CourseRow, 'id'>;
  chapters: EntityTable<ChapterRow, 'id'>;
  cards: EntityTable<CardRow, 'id'>;
  reviews: EntityTable<ReviewLogRow, 'id'>;
  pdfs: EntityTable<PdfRow, 'courseId'>;
  meta: EntityTable<MetaRow, 'key'>;
};

db.version(1).stores({
  courses: 'id, title, createdAt',
  chapters: 'id, courseId, number',
  cards: 'id, courseId, chapterId, due',
  reviews: '++id, cardId, courseId, at',
  pdfs: 'courseId',
  meta: 'key',
});

export function slug(s: string): string {
  return (
    s
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/ß/g, 'ss')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 60) || 'kurs'
  );
}

export async function getMeta<T>(key: string, fallback: T): Promise<T> {
  const row = await db.meta.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setMeta(key: string, value: unknown): Promise<void> {
  await db.meta.put({ key, value });
}
