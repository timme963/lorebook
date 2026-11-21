/** Cheat sheet: every objective with three sentences that answer it. */
import { z } from 'zod';
import { db, type ChapterRow } from './db';
import { getLang, tr } from './i18n';
import { parseLenientJson } from './importer';
import { applyZodLocale } from './schema';

const SummariesSchema = z.object({
  summaries: z.array(z.object({ id: z.string().trim().min(1), summary: z.string().trim().min(1) })).min(1),
});

export function missingSummaries(ch: ChapterRow): number {
  return ch.content.objectives.filter((o) => !o.summary).length;
}

/** Prompt that asks the user's model for the summaries a chapter imported before this feature still lacks. */
export function summaryPrompt(ch: ChapterRow): string {
  const objectives = JSON.stringify(
    ch.content.objectives.map((o) => ({ id: o.id, text: o.text, page: o.source.page })),
    null,
    2,
  );
  const example = '{ "summaries": [ { "id": "o1", "summary": "…" } ] }';
  if (getLang() === 'en') {
    return `Use the attached PDF (chapter "${ch.content.title}", PDF pages ${ch.content.pages[0]}–${ch.content.pages[1]}). For each learning objective below, write a "summary": exactly 3 sentences in your own words that fully answer the objective – the core statement, what matters most about it (conditions, formula, distinction) and an example or consequence. It goes on an exam cheat sheet, so it must make sense on its own and must be backed by the PDF. Write formulas as LaTeX between \\( and \\) with doubled backslashes in the JSON.

Objectives:
${objectives}

Reply ONLY with a JSON object in a single \`\`\`json code block:
${example}`;
  }
  return `Nutze das angehängte PDF (Kapitel „${ch.content.title}“, PDF-Seiten ${ch.content.pages[0]}–${ch.content.pages[1]}). Schreibe für jedes Lernziel unten eine "summary": genau 3 Sätze in eigenen Worten, die das Lernziel vollständig beantworten – die Kernaussage, das Wichtigste dazu (Bedingungen, Formel, Abgrenzung) und ein Beispiel oder eine Folge. Sie kommt auf einen Spickzettel für die Prüfung, muss also für sich allein verständlich und durch das PDF gedeckt sein. Formeln als LaTeX zwischen \\( und \\), im JSON mit verdoppelten Backslashes.

Lernziele:
${objectives}

Antworte AUSSCHLIESSLICH mit einem JSON-Objekt in einem einzigen \`\`\`json-Codeblock:
${example}`;
}

/** Stores pasted summaries on the chapter's objectives; returns how many objectives got one. */
export async function applySummaries(chapterId: string, raw: string): Promise<number> {
  const lenient = parseLenientJson(raw);
  if (!lenient.ok) throw new Error(lenient.error);
  applyZodLocale();
  const parsed = SummariesSchema.safeParse(lenient.value);
  if (!parsed.success) {
    throw new Error(
      tr(
        'Das Format passt nicht. Erwartet wird {"summaries": [{"id": "o1", "summary": "…"}]}.',
        'The format does not match. Expected {"summaries": [{"id": "o1", "summary": "…"}]}.',
      ),
    );
  }
  const byId = new Map(parsed.data.summaries.map((s) => [s.id, s.summary]));
  return db.transaction('rw', db.chapters, async () => {
    const chapter = await db.chapters.get(chapterId);
    if (!chapter) throw new Error(tr('Kapitel nicht gefunden.', 'Chapter not found.'));
    let applied = 0;
    const objectives = chapter.content.objectives.map((o) => {
      const summary = byId.get(o.id);
      if (!summary) return o;
      applied++;
      return { ...o, summary };
    });
    if (applied === 0) {
      throw new Error(
        tr(
          'Keine der IDs passt zu den Lernzielen dieses Kapitels.',
          "None of the IDs match this chapter's objectives.",
        ),
      );
    }
    await db.chapters.update(chapterId, { content: { ...chapter.content, objectives } });
    return applied;
  });
}
