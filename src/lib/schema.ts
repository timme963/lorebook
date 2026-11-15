import { z } from 'zod';

// Fehlermeldungen beim Import auf Deutsch
z.config(z.locales.de());

/** Format-Version der Kapitel-Dateien. Prompts und Validierung müssen dazu passen. */
export const FORMAT_VERSION = 1;

const nonEmpty = z.string().trim().min(1, 'darf nicht leer sein');

export const SourceSchema = z.object({
  page: z.number().int().min(1, 'Seitenzahl muss ≥ 1 sein'),
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
    options: z.array(nonEmpty).min(2, 'mindestens 2 Optionen').max(6, 'höchstens 6 Optionen'),
    correct: z.number().int().min(0),
  })
  .refine((q) => q.correct < q.options.length, {
    message: '"correct" zeigt auf keine vorhandene Option',
    path: ['correct'],
  });

export const ClozeQuestionSchema = z
  .object({
    ...base,
    type: z.literal('cloze'),
    answers: z.array(nonEmpty).min(1, 'mindestens eine akzeptierte Antwort'),
  })
  .refine((q) => q.prompt.includes('___'), {
    message: 'Lückentext braucht "___" als Platzhalter im prompt',
    path: ['prompt'],
  });

export const OpenQuestionSchema = z.object({
  ...base,
  type: z.literal('open'),
  modelAnswer: nonEmpty,
  rubric: z.array(nonEmpty).min(1, 'mindestens ein Bewertungspunkt'),
});

export const QuestionSchema = z.discriminatedUnion('type', [
  McQuestionSchema,
  ClozeQuestionSchema,
  OpenQuestionSchema,
]);

export const ObjectiveSchema = z.object({
  id: nonEmpty,
  text: nonEmpty,
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
  scenes: z.array(SceneSchema).min(1, 'mindestens eine Szene'),
  ending: nonEmpty,
});

export const ChapterSchema = z.object({
  number: z.number().int().min(0),
  title: nonEmpty,
  pages: z.tuple([z.number().int().min(1), z.number().int().min(1)]),
  objectives: z.array(ObjectiveSchema).min(1, 'mindestens ein Lernziel'),
  pretest: z.array(QuestionSchema).min(1, 'mindestens eine Vorabfrage'),
  story: StorySchema,
  posttest: z.array(QuestionSchema).min(1, 'mindestens eine Nachfrage'),
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

export const LEVEL_LABEL: Record<Level, string> = {
  remember: 'Erinnern',
  understand: 'Verstehen',
  apply: 'Anwenden',
  transfer: 'Transfer',
};
