import { z } from 'zod';
import { getLang, tr } from './i18n';

/** Import error messages in the current language (call before every parse) */
export function applyZodLocale(): void {
  z.config(getLang() === 'en' ? z.locales.en() : z.locales.de());
}
applyZodLocale();

/** Format version of chapter files. Prompts and validation must match it. */
export const FORMAT_VERSION = 1;

const nonEmpty = z
  .string()
  .trim()
  .min(1, { error: () => tr('darf nicht leer sein', 'must not be empty') });

export const SourceSchema = z.object({
  page: z
    .number()
    .int()
    .min(1, { error: () => tr('Seitenzahl muss ≥ 1 sein', 'Page number must be ≥ 1') }),
  quote: nonEmpty,
});

export const LEVELS = ['remember', 'understand', 'apply', 'transfer'] as const;
export const LevelSchema = z.enum(LEVELS);

const base = {
  id: nonEmpty,
  objective: nonEmpty,
  level: LevelSchema,
  prompt: nonEmpty,
  explanation: nonEmpty,
  source: SourceSchema,
};

export const McQuestionSchema = z
  .object({
    ...base,
    type: z.literal('mc'),
    options: z
      .array(nonEmpty)
      .min(2, { error: () => tr('mindestens 2 Optionen', 'at least 2 options') })
      .max(6, { error: () => tr('höchstens 6 Optionen', 'at most 6 options') }),
    /** number = single choice (exactly one correct), list = multiple choice (1 to all correct) */
    correct: z.union([z.number().int().min(0), z.array(z.number().int().min(0)).min(1)]),
  })
  .refine((q) => correctSet(q).every((i) => i < q.options.length), {
    error: () => tr('"correct" zeigt auf keine vorhandene Option', '"correct" does not point to an existing option'),
    path: ['correct'],
  })
  .refine((q) => !Array.isArray(q.correct) || new Set(q.correct).size === q.correct.length, {
    error: () => tr('"correct" enthält eine Option doppelt', '"correct" lists an option twice'),
    path: ['correct'],
  });

// ---------- Multiple choice: single and multi select ----------

type McLike = { correct: number | number[]; options: string[] };

/** Multi select ("more than one answer possible")? */
export const isMulti = (q: McLike): boolean => Array.isArray(q.correct);

/** Indices of the correct options, sorted */
export const correctSet = (q: McLike): number[] =>
  (Array.isArray(q.correct) ? [...q.correct] : [q.correct]).sort((a, b) => a - b);

/** Stored answer "0,2" → [0, 2] */
export const parseGiven = (given: string): number[] =>
  given.trim() === ''
    ? []
    : [
        ...new Set(
          given
            .split(',')
            .map(Number)
            .filter((n) => Number.isInteger(n) && n >= 0),
        ),
      ].sort((a, b) => a - b);

export const encodeGiven = (idx: number[]): string => [...new Set(idx)].sort((a, b) => a - b).join(',');

/** Score 0..1: single choice all or nothing; multi select (hits − wrong picks) / number correct, at least 0. */
export function mcScore(q: McLike, given: string): number {
  const right = correctSet(q);
  const picked = parseGiven(given);
  if (!isMulti(q)) return picked.length === 1 && picked[0] === right[0] ? 1 : 0;
  const hits = picked.filter((i) => right.includes(i)).length;
  return Math.max(0, (hits - (picked.length - hits)) / right.length);
}

/** Exactly right? (multi select: exactly the correct options picked) */
export function mcCorrect(q: McLike, given: string): boolean {
  const right = correctSet(q);
  const picked = parseGiven(given);
  return picked.length === right.length && picked.every((v, i) => v === right[i]);
}

export const ClozeQuestionSchema = z
  .object({
    ...base,
    type: z.literal('cloze'),
    answers: z
      .array(nonEmpty)
      .min(1, { error: () => tr('mindestens eine akzeptierte Antwort', 'at least one accepted answer') }),
  })
  .refine((q) => q.prompt.includes('___'), {
    error: () =>
      tr('Lückentext braucht "___" als Platzhalter im prompt', 'Cloze needs "___" as a placeholder in the prompt'),
    path: ['prompt'],
  });

export const OpenQuestionSchema = z.object({
  ...base,
  type: z.literal('open'),
  modelAnswer: nonEmpty,
  rubric: z.array(nonEmpty).min(1, { error: () => tr('mindestens ein Bewertungspunkt', 'at least one rubric point') }),
});

export const QuestionSchema = z.discriminatedUnion('type', [McQuestionSchema, ClozeQuestionSchema, OpenQuestionSchema]);

export const ObjectiveSchema = z.object({
  id: nonEmpty,
  text: nonEmpty,
  /** Three sentences that answer the objective, shown on the cheat sheet; optional so existing chapter files stay valid */
  summary: nonEmpty.optional(),
  source: SourceSchema,
});

export const SceneSchema = z.object({
  objective: nonEmpty,
  title: nonEmpty,
  text: nonEmpty,
  concept: nonEmpty,
});

export const StorySchema = z.object({
  title: nonEmpty,
  setting: nonEmpty,
  scenes: z.array(SceneSchema).min(1, { error: () => tr('mindestens eine Szene', 'at least one scene') }),
  ending: nonEmpty,
});

export const ChapterSchema = z.object({
  number: z.number().int().min(0),
  title: nonEmpty,
  pages: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  objectives: z.array(ObjectiveSchema).min(1, { error: () => tr('mindestens ein Lernziel', 'at least one objective') }),
  pretest: z
    .array(QuestionSchema)
    .min(1, { error: () => tr('mindestens eine Vorabfrage', 'at least one pre-question') }),
  story: StorySchema,
  posttest: z
    .array(QuestionSchema)
    .min(1, { error: () => tr('mindestens eine Nachfrage', 'at least one post-question') }),
  review: z.array(QuestionSchema).default([]),
});

export const ChapterFileSchema = z.object({
  lorebook: z.literal(FORMAT_VERSION),
  course: z.object({
    title: nonEmpty,
    source: z.string().optional(),
  }),
  chapter: ChapterSchema,
  verified: z.boolean().default(false),
  verificationNotes: z.array(z.string()).default([]),
});

export type Source = z.infer<typeof SourceSchema>;
export type Level = z.infer<typeof LevelSchema>;
export type Question = z.infer<typeof QuestionSchema>;
export type McQuestion = z.infer<typeof McQuestionSchema>;
export type ClozeQuestion = z.infer<typeof ClozeQuestionSchema>;
export type OpenQuestion = z.infer<typeof OpenQuestionSchema>;
export type Objective = z.infer<typeof ObjectiveSchema>;
export type Story = z.infer<typeof StorySchema>;
export type ChapterContent = z.infer<typeof ChapterSchema>;
export type ChapterFile = z.infer<typeof ChapterFileSchema>;

export const LEVEL_LABEL = (): Record<Level, string> => ({
  remember: tr('Erinnern', 'Remember'),
  understand: tr('Verstehen', 'Understand'),
  apply: tr('Anwenden', 'Apply'),
  transfer: 'Transfer',
});
