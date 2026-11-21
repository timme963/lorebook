/** Sharing a course as a file: all chapters with their (edited) content, without progress or the PDF. */
import { z } from 'zod';
import { downloadBlob } from './backup';
import { importChapter } from './courses';
import { db, slug, type CourseRow } from './db';
import { tr } from './i18n';
import { parseLenientJson } from './importer';
import { applyZodLocale, ChapterFileSchema, FORMAT_VERSION, type ChapterFile } from './schema';

/** Version of the shared course file; chapters inside use the chapter format version. */
const COURSE_SHARE_VERSION = 1;

const CourseShareSchema = z.object({
  lorebookCourse: z.literal(COURSE_SHARE_VERSION),
  course: z.object({ title: z.string().trim().min(1), source: z.string().optional() }),
  chapters: z.array(ChapterFileSchema).min(1),
});

export type CourseShare = z.infer<typeof CourseShareSchema>;

export type ShareParseResult = { ok: true; share: CourseShare } | { ok: false; errors: string[] };

/** Cheap check before full validation, so chapter imports are not mistaken for a shared course. */
export function looksLikeCourseShare(raw: string): boolean {
  return raw.includes('"lorebookCourse"');
}

export async function buildCourseShare(courseId: string): Promise<CourseShare> {
  const course = await db.courses.get(courseId);
  if (!course) throw new Error(tr('Kurs nicht gefunden.', 'Course not found.'));
  const chapters = await db.chapters.where('courseId').equals(courseId).sortBy('number');
  const courseInfo = { title: course.title, source: course.source };
  return {
    lorebookCourse: COURSE_SHARE_VERSION,
    course: courseInfo,
    chapters: chapters.map((ch): ChapterFile => ({
      lorebook: FORMAT_VERSION,
      course: courseInfo,
      chapter: ch.content,
      verified: ch.verified,
      verificationNotes: ch.verificationNotes,
    })),
  };
}

/** Offers the course file: the share sheet on phones (and in the app), otherwise a download. */
export async function shareCourse(courseId: string): Promise<void> {
  const share = await buildCourseShare(courseId);
  const filename = `${slug(share.course.title)}.lorebook.json`;
  const blob = new Blob([JSON.stringify(share)], { type: 'application/json' });
  const file = new File([blob], filename, { type: 'application/json' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: share.course.title });
      return;
    } catch (e) {
      // the user closing the share sheet is not an error; anything else falls back to a download
      if (e instanceof DOMException && e.name === 'AbortError') return;
    }
  }
  await downloadBlob(blob, filename, tr('Lorebook-Kurs', 'Lorebook course'));
}

export function parseCourseShare(raw: string): ShareParseResult {
  const lenient = parseLenientJson(raw);
  if (!lenient.ok) return { ok: false, errors: [lenient.error] };
  applyZodLocale();
  const parsed = CourseShareSchema.safeParse(lenient.value);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  }
  return { ok: true, share: parsed.data };
}

/** First course ID derived from the title that is not taken yet ("statistik", "statistik-2", …). */
async function freeCourseId(title: string): Promise<string> {
  const base = slug(title);
  let id = base;
  for (let n = 2; await db.courses.get(id); n++) id = `${base}-${n}`;
  return id;
}

/**
 * Imports every chapter of a shared course into a new course of its own. A course with the same title is never
 * touched: replacing its chapters would drop the recipient's progress and their own corrections.
 * All chapters go in together or not at all.
 */
export async function importCourseShare(share: CourseShare): Promise<CourseRow> {
  return db.transaction('rw', [db.courses, db.chapters, db.cards, db.tombstones], async () => {
    const course: CourseRow = {
      id: await freeCourseId(share.course.title),
      title: share.course.title,
      source: share.course.source,
      createdAt: Date.now(),
    };
    await db.courses.put(course);
    for (const chapter of share.chapters) await importChapter({ ...chapter, course: share.course }, course.id);
    return course;
  });
}
