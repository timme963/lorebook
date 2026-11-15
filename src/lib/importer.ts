import { ChapterFileSchema, type ChapterFile, type Question } from './schema';

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

  if (!raw.trim()) return { ok: false, errors: ['Es wurde nichts eingefügt.'], warnings };

  let json: unknown;
  const extracted = extractJson(raw);
  try {
    json = JSON.parse(extracted);
  } catch {
    try {
      json = JSON.parse(normalizeQuotes(extracted));
      warnings.push('Typografische Anführungszeichen wurden automatisch korrigiert.');
    } catch (e) {
      return {
        ok: false,
        errors: [`Kein gültiges JSON: ${(e as Error).message}. Oft ist die Antwort abgeschnitten – dann im Chat „weiter“ schreiben und alles zusammen einfügen.`],
        warnings,
      };
    }
  }

  const parsed = ChapterFileSchema.safeParse(json);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 25)) {
      errors.push(`${formatPath(issue.path) || '(Wurzel)'}: ${issue.message}`);
    }
    if (parsed.error.issues.length > 25) errors.push(`… und ${parsed.error.issues.length - 25} weitere Fehler`);
    return { ok: false, errors, warnings };
  }

  const data = parsed.data;
  const ch = data.chapter;
  const objectiveIds = new Set(ch.objectives.map((o) => o.id));
  if (objectiveIds.size !== ch.objectives.length) errors.push('chapter.objectives: Lernziel-IDs sind nicht eindeutig.');

  const qIds = new Set<string>();
  for (const { list, q, i } of allQuestions(data)) {
    const where = `chapter.${list}[${i}]`;
    if (qIds.has(q.id)) errors.push(`${where}.id: Frage-ID "${q.id}" kommt doppelt vor.`);
    qIds.add(q.id);
    if (!objectiveIds.has(q.objective)) errors.push(`${where}.objective: Lernziel "${q.objective}" existiert nicht.`);
    if (q.source.page < ch.pages[0] || q.source.page > ch.pages[1]) {
      warnings.push(`${where}: Quellseite ${q.source.page} liegt außerhalb der Kapitelseiten ${ch.pages[0]}–${ch.pages[1]}.`);
    }
  }
  ch.story.scenes.forEach((s, i) => {
    if (!objectiveIds.has(s.objective)) errors.push(`chapter.story.scenes[${i}].objective: Lernziel "${s.objective}" existiert nicht.`);
  });
  const covered = new Set(ch.story.scenes.map((s) => s.objective));
  for (const o of ch.objectives) {
    if (!covered.has(o.id)) warnings.push(`Lernziel ${o.id} kommt in keiner Story-Szene vor.`);
  }
  const deep = allQuestions(data).filter(({ q }) => q.level === 'apply' || q.level === 'transfer').length;
  const total = allQuestions(data).length;
  if (total > 0 && deep / total < 0.3) {
    warnings.push(`Nur ${Math.round((deep / total) * 100)} % Anwendungs-/Transferfragen (Ziel: mindestens 30 %).`);
  }
  if (!data.verified) warnings.push('Noch nicht geprüft. Empfehlung: Prompt B (Prüfung) in einem neuen Chat laufen lassen.');

  return { ok: errors.length === 0, data: errors.length === 0 ? data : undefined, errors, warnings };
}

/** Text, den man zurück in den Chat kopiert, damit das Modell das Format repariert. */
export function repairPrompt(errors: string[]): string {
  return [
    'Dein JSON passt nicht zum Lorebook-Format. Korrigiere ausschließlich diese Fehler und gib danach das KOMPLETTE JSON erneut in einem einzigen ```json-Codeblock aus, ohne weiteren Text:',
    '',
    ...errors.map((e) => `- ${e}`),
  ].join('\n');
}
