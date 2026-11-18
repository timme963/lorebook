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

/** Gerätelokale Werte (Sync-Stand, Geräte-ID) – werden nie synchronisiert. */
export interface LocalRow {
  key: string;
  value: unknown;
}

/** Merkt sich gelöschte Zeilen, damit die Löschung auch auf anderen Geräten ankommt. */
export interface TombstoneRow {
  key: string; // `${tbl}:${id}`
  tbl: SyncTable;
  id: string;
  _ts: number;
}

export const SYNC_TABLES = ['courses', 'chapters', 'cards', 'meta'] as const;
export type SyncTable = (typeof SYNC_TABLES)[number];

export const db = new Dexie('lorebook') as Dexie & {
  courses: EntityTable<CourseRow, 'id'>;
  chapters: EntityTable<ChapterRow, 'id'>;
  cards: EntityTable<CardRow, 'id'>;
  reviews: EntityTable<ReviewLogRow, 'id'>;
  pdfs: EntityTable<PdfRow, 'courseId'>;
  meta: EntityTable<MetaRow, 'key'>;
  local: EntityTable<LocalRow, 'key'>;
  tombstones: EntityTable<TombstoneRow, 'key'>;
};

db.version(1).stores({
  courses: 'id, title, createdAt',
  chapters: 'id, courseId, number',
  cards: 'id, courseId, chapterId, due',
  reviews: '++id, cardId, courseId, at',
  pdfs: 'courseId',
  meta: 'key',
});

db.version(2)
  .stores({
    courses: 'id, title, createdAt, _ts',
    chapters: 'id, courseId, number, _ts',
    cards: 'id, courseId, chapterId, due, _ts',
    meta: 'key, _ts',
    local: 'key',
    tombstones: 'key, _ts',
  })
  .upgrade(async (tx) => {
    const now = Date.now();
    for (const t of SYNC_TABLES) {
      await tx.table(t).toCollection().modify((row: { _ts?: number }) => {
        row._ts = now;
      });
    }
  });

// ---------- Änderungs-Zeitstempel für den Sync ----------
// Jede lokale Änderung bekommt _ts (ms). Beim Sync gewinnt der höhere _ts.
// Transaktionen, die Server-Daten einspielen, sind mit __remote markiert und stempeln nicht.

type Tx = { __remote?: boolean; storeNames: string[]; table: (n: string) => { put: (v: unknown) => unknown } };
const changeListeners = new Set<() => void>();
const changeListener = { current: () => changeListeners.forEach((f) => f()) };

/** Wird bei jeder lokalen Änderung an synchronisierten Tabellen aufgerufen (Sync, Erinnerungen …). */
export function onLocalChange(fn: () => void): () => void {
  changeListeners.add(fn);
  return () => changeListeners.delete(fn);
}

for (const t of SYNC_TABLES) {
  const table = db.table(t);
  table.hook('creating', function (_pk, obj: { _ts?: number }, tx) {
    if ((tx as unknown as Tx).__remote) return;
    obj._ts = Math.max(Date.now(), (obj._ts ?? 0) + 1);
    changeListener.current();
  });
  table.hook('updating', function (_mods, _pk, obj: { _ts?: number }, tx) {
    if ((tx as unknown as Tx).__remote) return;
    changeListener.current();
    return { _ts: Math.max(Date.now(), (obj._ts ?? 0) + 1) };
  });
  table.hook('deleting', function (pk, obj: { _ts?: number }, tx) {
    const trans = tx as unknown as Tx;
    if (trans.__remote) return;
    if (!trans.storeNames.includes('tombstones')) {
      console.warn(`[lorebook] Löschung in ${t} ohne tombstones-Tabelle in der Transaktion – wird nicht synchronisiert`);
      return;
    }
    trans.table('tombstones').put({ key: `${t}:${pk}`, tbl: t, id: String(pk), _ts: Math.max(Date.now(), (obj?._ts ?? 0) + 1) });
    changeListener.current();
  });
}

export async function getLocal<T>(key: string, fallback: T): Promise<T> {
  const row = await db.local.get(key);
  return row ? (row.value as T) : fallback;
}

export async function setLocal(key: string, value: unknown): Promise<void> {
  await db.local.put({ key, value });
}

export async function deviceId(): Promise<string> {
  let id = await getLocal<string | null>('deviceId', null);
  if (!id) {
    id = crypto.randomUUID().slice(0, 8);
    await setLocal('deviceId', id);
  }
  return id;
}

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
