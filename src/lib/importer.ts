import { applyZodLocale, ChapterFileSchema, type ChapterFile, type Question } from './schema';
import { tr } from './i18n';

export interface ImportResult {
  ok: boolean;
  data?: ChapterFile;
  errors: string[];
  warnings: string[];
}

/** Holt das JSON-Objekt aus einer Chat-Antwort (Codeblöcke, Text davor/danach). */
export function extractJson(raw: string): string {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return text;
  return text.slice(start, end + 1);
}

/** Typografische Anführungszeichen außerhalb von Strings ersetzen manche Chats – häufigster Formatfehler. */
function normalizeQuotes(json: string): string {
  return json.replace(/[“”„]/g, (m, offset: number, s: string) => {
    // nur ersetzen, wenn es wie ein JSON-Strukturzeichen aussieht
    const before = s.slice(Math.max(0, offset - 2), offset);
    const after = s.slice(offset + 1, offset + 3);
    return /[{,:\[]\s*$/.test(before) || /^\s*[:,}\]]/.test(after) ? '"' : m;
  });
}

function formatPath(path: PropertyKey[]): string {
  return path
    .map((p) => (typeof p === 'number' ? `[${p}]` : `.${String(p)}`))
    .join('')
    .replace(/^\./, '');
}

function allQuestions(file: ChapterFile): { list: string; q: Question; i: number }[] {
  const out: { list: string; q: Question; i: number }[] = [];
  for (const list of ['pretest', 'posttest', 'review'] as const) {
    file.chapter[list].forEach((q, i) => out.push({ list, q, i }));
  }
  return out;
}

export function parseChapterFile(raw: string): ImportResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!raw.trim()) return { ok: false, errors: [tr('Es wurde nichts eingefügt.', 'Nothing was pasted.')], warnings };

  let json: unknown;
  const extracted = extractJson(raw);
  try {
    json = JSON.parse(extracted);
  } catch {
    try {
      json = JSON.parse(normalizeQuotes(extracted));
      warnings.push(tr('Typografische Anführungszeichen wurden automatisch korrigiert.', 'Typographic quotes were corrected automatically.'));
    } catch (e) {
      return {
        ok: false,
        errors: [
          tr(
            `Kein gültiges JSON: ${(e as Error).message}. Oft ist die Antwort abgeschnitten – dann im Chat „weiter“ schreiben und alles zusammen einfügen.`,
            `Not valid JSON: ${(e as Error).message}. Often the answer was cut off – write "continue" in the chat and paste everything together.`,
          ),
        ],
        warnings,
      };
    }
  }

  applyZodLocale();
  const parsed = ChapterFileSchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 25)) {
      errors.push(`${formatPath(issue.path) || tr('(Wurzel)', '(root)')}: ${issue.message}`);
    }
    if (parsed.error.issues.length > 25) errors.push(tr(`… und ${parsed.error.issues.length - 25} weitere Fehler`, `… and ${parsed.error.issues.length - 25} more errors`));
    return { ok: false, errors, warnings };
  }

  const data = parsed.data;
  const ch = data.chapter;
  const objectiveIds = new Set(ch.objectives.map((o) => o.id));
  if (objectiveIds.size !== ch.objectives.length) errors.push(tr('chapter.objectives: Lernziel-IDs sind nicht eindeutig.', 'chapter.objectives: objective IDs are not unique.'));

  const qIds = new Set<string>();
  for (const { list, q, i } of allQuestions(data)) {
    const where = `chapter.${list}[${i}]`;
    if (qIds.has(q.id)) errors.push(tr(`${where}.id: Frage-ID "${q.id}" kommt doppelt vor.`, `${where}.id: question ID "${q.id}" appears twice.`));
    qIds.add(q.id);
    if (!objectiveIds.has(q.objective)) errors.push(tr(`${where}.objective: Lernziel "${q.objective}" existiert nicht.`, `${where}.objective: objective "${q.objective}" does not exist.`));
    if (q.source.page < ch.pages[0] || q.source.page > ch.pages[1]) {
      warnings.push(
        tr(
          `${where}: Quellseite ${q.source.page} liegt außerhalb der Kapitelseiten ${ch.pages[0]}–${ch.pages[1]}.`,
          `${where}: source page ${q.source.page} is outside the chapter pages ${ch.pages[0]}–${ch.pages[1]}.`,
        ),
      );
    }
  }
  ch.story.scenes.forEach((s, i) => {
    if (!objectiveIds.has(s.objective)) errors.push(tr(`chapter.story.scenes[${i}].objective: Lernziel "${s.objective}" existiert nicht.`, `chapter.story.scenes[${i}].objective: objective "${s.objective}" does not exist.`));
  });
  const covered = new Set(ch.story.scenes.map((s) => s.objective));
  for (const o of ch.objectives) {
    if (!covered.has(o.id)) warnings.push(tr(`Lernziel ${o.id} kommt in keiner Story-Szene vor.`, `Objective ${o.id} does not appear in any story scene.`));
  }
  const deep = allQuestions(data).filter(({ q }) => q.level === 'apply' || q.level === 'transfer').length;
  const total = allQuestions(data).length;
  if (total > 0 && deep / total < 0.3) {
    warnings.push(tr(`Nur ${Math.round((deep / total) * 100)} % Anwendungs-/Transferfragen (Ziel: mindestens 30 %).`, `Only ${Math.round((deep / total) * 100)} % application/transfer questions (target: at least 30 %).`));
  }
  if (!data.verified) warnings.push(tr('Noch nicht geprüft. Empfehlung: Prompt B (Prüfung) in einem neuen Chat laufen lassen.', 'Not verified yet. Recommendation: run Prompt B (check) in a new chat.'));

  return { ok: errors.length === 0, data: errors.length === 0 ? data : undefined, errors, warnings };
}

/** Text, den man zurück in den Chat kopiert, damit das Modell das Format repariert. */
export function repairPrompt(errors: string[]): string {
  return [
    tr(
      'Dein JSON passt nicht zum Lorebook-Format. Korrigiere ausschließlich diese Fehler und gib danach das KOMPLETTE JSON erneut in einem einzigen ```json-Codeblock aus, ohne weiteren Text:',
      'Your JSON does not match the Lorebook format. Fix only these errors and then output the COMPLETE JSON again in a single ```json code block, with no other text:',
    ),
    '',
    ...errors.map((e) => `- ${e}`),
  ].join('\n');
}
