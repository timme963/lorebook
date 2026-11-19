import { DEMO_CHAPTER } from './demo';

/** Demo chapter as loose JSON, so tests can break it in ways the schema types would not allow. */
export interface LooseChapterFile {
  chapter: {
    pretest: { correct: unknown }[];
    posttest: { objective: string }[];
    review: { id: string }[];
    story: { ending?: string };
  };
}

export function looseDemo(): LooseChapterFile {
  return JSON.parse(JSON.stringify(DEMO_CHAPTER)) as LooseChapterFile;
}
