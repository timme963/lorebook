import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import CopyButton from '../components/CopyButton';
import Rich from '../components/Rich';
import { db, type ChapterRow } from '../lib/db';
import { tr } from '../lib/i18n';
import { applySummaries, missingSummaries, summaryPrompt } from '../lib/sheet';
import { href } from '../router';

/** Pasting the summaries a chapter imported before the cheat sheet existed still lacks. */
function MissingSummaries({ chapter }: { readonly chapter: ChapterRow }) {
  const [open, setOpen] = useState(false);
  const [pasted, setPasted] = useState('');
  const [error, setError] = useState<string>();

  async function apply() {
    setError(undefined);
    try {
      await applySummaries(chapter.id, pasted);
      setPasted('');
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  if (!open) {
    return (
      <div className="feedback neutral small no-print">
        {tr(
          `${missingSummaries(chapter)} Lernziele haben noch keine Zusammenfassung – das Kapitel wurde vor dem Spickzettel importiert.`,
          `${missingSummaries(chapter)} objectives have no summary yet – the chapter was imported before the cheat sheet existed.`,
        )}{' '}
        <button className="btn small" onClick={() => setOpen(true)}>
          {tr('Nachholen', 'Add them')}
        </button>
      </div>
    );
  }
  return (
    <div className="card stack no-print">
      <p className="small">
        {tr(
          'Kopiere den Prompt in den Chat, in dem du das Kapitel erzeugt hast (mit dem PDF), und füge die Antwort hier ein.',
          'Copy the prompt into the chat where you generated the chapter (with the PDF) and paste the answer here.',
        )}
      </p>
      <CopyButton
        text={summaryPrompt(chapter)}
        label={tr('Prompt kopieren', 'Copy prompt')}
        className="btn self-start"
      />
      <textarea
        className="input"
        rows={5}
        value={pasted}
        onChange={(e) => setPasted(e.target.value)}
        placeholder={tr('Antwort hier einfügen', 'Paste the answer here')}
      />
      {error && <p className="error small">{error}</p>}
      <div className="row gap">
        <button className="btn primary" disabled={!pasted.trim()} onClick={apply}>
          {tr('Übernehmen', 'Apply')}
        </button>
        <button className="btn ghost" onClick={() => setOpen(false)}>
          {tr('Abbrechen', 'Cancel')}
        </button>
      </div>
    </div>
  );
}

/** Printable cheat sheet of a course: every objective with three sentences that answer it. */
export default function SheetPage({ courseId }: { courseId: string }) {
  const data = useLiveQuery(async () => {
    const [course, chapters] = await Promise.all([
      db.courses.get(courseId),
      db.chapters.where('courseId').equals(courseId).sortBy('number'),
    ]);
    return { course, chapters };
  }, [courseId]);
  if (!data) return null;
  const { course, chapters } = data;
  if (!course) return <p>{tr('Kurs nicht gefunden.', 'Course not found.')}</p>;

  return (
    <div className="stack sheet">
      <div className="row between gap wrap no-print">
        <a className="back" href={href({ name: 'course', id: courseId })}>
          {tr('← Zum Kurs', '← To the course')}
        </a>
        <button className="btn" onClick={() => window.print()}>
          {tr('🖨 Drucken / als PDF', '🖨 Print / save as PDF')}
        </button>
      </div>
      <h1>
        {tr('Spickzettel', 'Cheat sheet')}: {course.title}
      </h1>
      {chapters.map((ch) => (
        <section key={ch.id} className="card stack sheet-chapter">
          <h2>
            {ch.number}. {ch.content.title}
          </h2>
          {missingSummaries(ch) > 0 && <MissingSummaries chapter={ch} />}
          <dl className="sheet-list">
            {ch.content.objectives.map((o) => (
              <div key={o.id}>
                <dt>
                  <Rich text={o.text} />
                </dt>
                <dd>{o.summary ? <Rich text={o.summary} /> : <em className="muted">–</em>}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
