import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { deleteChapter, deleteCourse, resetChapter, updateQuestion, type BossResult } from '../lib/courses';
import { db, getMeta, type ChapterRow } from '../lib/db';
import { dueCards, retuneSchedules, unflagCard } from '../lib/srs';
import { go, href } from '../router';
import { plural, tr } from '../lib/i18n';
import ObjectiveInsights from '../components/ObjectiveInsights';
import QuestionEditor from '../components/QuestionEditor';
import type { Question } from '../lib/schema';

const PHASE_LABEL = (): Record<ChapterRow['phase'], string> => ({
  new: tr('Neu', 'New'),
  pretest: tr('Vorabfragen', 'Pre-questions'),
  story: 'Story',
  posttest: tr('Nachfragen', 'Post-questions'),
  done: tr('Gemeistert', 'Mastered'),
});

function pct(v?: number) {
  return v === undefined ? '–' : `${Math.round(v * 100)} %`;
}

export default function CoursePage({ id }: { id: string }) {
  const data = useLiveQuery(async () => {
    const course = await db.courses.get(id);
    if (!course) return { course: null };
    const [chapters, due, pdf, boss, flagged] = await Promise.all([
      db.chapters.where('courseId').equals(id).sortBy('number'),
      dueCards(id),
      db.pdfs.get(id),
      getMeta<BossResult | null>(`boss:${id}`, null),
      db.cards
        .where('courseId')
        .equals(id)
        .filter((c) => !!c.flagged)
        .toArray(),
    ]);
    return { course, chapters, due, pdf, boss, flagged };
  }, [id]);
  const [menu, setMenu] = useState<string>();
  const [editingCard, setEditingCard] = useState<string>();

  if (!data) return null;
  if (!data.course) {
    return (
      <div className="card empty">
        <h2>{tr('Kurs nicht gefunden', 'Course not found')}</h2>
        <a className="btn" href={href({ name: 'home' })}>
          {tr('Zur Übersicht', 'To overview')}
        </a>
      </div>
    );
  }
  const { course, chapters, due, pdf, boss, flagged } = data;
  const allDone = chapters.length > 0 && chapters.every((c) => c.phase === 'done');

  async function onPdf(f?: File) {
    if (!f) return;
    await db.pdfs.put({ courseId: id, name: f.name, blob: f });
  }

  function findQuestion(chapterId: string, questionId: string): Question | undefined {
    const ch = chapters?.find((c) => c.id === chapterId);
    return ch && [...ch.content.pretest, ...ch.content.posttest, ...ch.content.review].find((x) => x.id === questionId);
  }

  function questionText(chapterId: string, questionId: string): string {
    return findQuestion(chapterId, questionId)?.prompt ?? questionId;
  }

  return (
    <div className="stack">
      <a className="back" href={href({ name: 'home' })}>
        {tr('← Übersicht', '← Overview')}
      </a>
      <div className="row between wrap gap">
        <div>
          <h1>{course.title}</h1>
          {course.source && <p className="muted small">{course.source}</p>}
        </div>
        <div className="row gap wrap">
          {due.length > 0 && (
            <a className="btn primary" href={href({ name: 'review', courseId: id })}>
              ↻ {tr(`${due.length} wiederholen`, `review ${due.length}`)}
            </a>
          )}
          <a className="btn" href={href({ name: 'import', courseId: id })}>
            {tr('+ Kapitel', '+ Chapter')}
          </a>
        </div>
      </div>

      <section className="card row between wrap gap">
        <div>
          <strong>{tr('PDF für Quellenansicht', 'PDF for source view')}</strong>
          <p className="muted small">
            {pdf
              ? `📎 ${pdf.name} ${tr('(bleibt nur in diesem Browser)', '(stays in this browser only)')}`
              : tr(
                  'Optional: Mit PDF springt „Quelle anzeigen“ direkt zur Originalseite.',
                  'Optional: with a PDF, "Source" jumps straight to the original page.',
                )}
          </p>
        </div>
        <div className="row gap">
          <label className="btn small">
            {pdf ? tr('Ersetzen', 'Replace') : tr('PDF hinzufügen', 'Add PDF')}
            <input type="file" accept="application/pdf" hidden onChange={(e) => onPdf(e.target.files?.[0])} />
          </label>
          {pdf && (
            <button className="btn small ghost" onClick={() => db.pdfs.delete(id)}>
              {tr('Entfernen', 'Remove')}
            </button>
          )}
        </div>
      </section>

      <h2>{tr('Quest-Karte', 'Quest map')}</h2>
      {chapters.length === 0 && (
        <p className="muted">
          {tr('Noch keine Kapitel. Importiere das erste.', 'No chapters yet. Import the first one.')}
        </p>
      )}
      <ol className="quest-map">
        {chapters.map((ch, i) => {
          const previous = chapters[i - 1];
          const locked = previous !== undefined && previous.phase !== 'done';
          return (
            <li key={ch.id} className={`quest ${ch.phase} ${locked ? 'locked' : ''}`}>
              <div className="quest-node">{ch.phase === 'done' ? '★' : locked ? '🔒' : ch.number}</div>
              <div className="card quest-card">
                <div className="row between gap">
                  <div className="grow">
                    <h3>
                      {ch.number}. {ch.content.title}
                    </h3>
                    <p className="muted small">
                      {PHASE_LABEL()[ch.phase]} · {tr('S.', 'p.')} {ch.content.pages[0]}–{ch.content.pages[1]} ·{' '}
                      {ch.verified ? tr('✓ geprüft', '✓ verified') : tr('⚠ ungeprüft', '⚠ unverified')}
                      {ch.phase === 'done' && (
                        <>
                          {' '}
                          · {tr('vorher', 'before')} {pct(ch.preScore)} → {tr('nachher', 'after')} {pct(ch.postScore)}
                        </>
                      )}
                    </p>
                  </div>
                  <button
                    className="btn small ghost"
                    onClick={() => setMenu(menu === ch.id ? undefined : ch.id)}
                    aria-label={tr('Optionen', 'Options')}
                  >
                    ⋯
                  </button>
                </div>
                {menu === ch.id && (
                  <div className="row gap wrap menu">
                    <button className="btn small" onClick={() => resetChapter(ch.id)}>
                      {tr('Ablauf neu starten', 'Restart chapter')}
                    </button>
                    <button
                      className="btn small danger"
                      onClick={() => {
                        if (
                          confirm(
                            tr(
                              `Kapitel „${ch.content.title}“ samt Wiederholungskarten löschen?`,
                              `Delete chapter "${ch.content.title}" including its review cards?`,
                            ),
                          )
                        )
                          void deleteChapter(ch.id);
                      }}
                    >
                      {tr('Löschen', 'Delete')}
                    </button>
                    {ch.verificationNotes.length > 0 && (
                      <details className="small">
                        <summary>{tr('Prüfnotizen', 'Verification notes')}</summary>
                        <ul>
                          {ch.verificationNotes.map((n, j) => (
                            <li key={j}>{n}</li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                )}
                {!locked && (
                  <a
                    className={`btn ${ch.phase === 'done' ? 'small' : 'primary'}`}
                    href={href({ name: 'chapter', id: ch.id })}
                  >
                    {ch.phase === 'new'
                      ? tr('Starten', 'Start')
                      : ch.phase === 'done'
                        ? tr('Story nochmal lesen', 'Read the story again')
                        : tr('Weitermachen', 'Continue')}
                  </a>
                )}
                {locked && (
                  <p className="muted small">
                    {tr(
                      `Wird nach Kapitel ${previous.number} freigeschaltet.`,
                      `Unlocks after chapter ${previous.number}.`,
                    )}
                  </p>
                )}
              </div>
            </li>
          );
        })}
        {chapters.length > 0 && (
          <li className={`quest boss ${allDone ? '' : 'locked'}`}>
            <div className="quest-node">⚔</div>
            <div className="card quest-card">
              <h3>{tr('Boss-Fight: Alles gemischt', 'Boss fight: everything mixed')}</h3>
              <p className="muted small">
                {tr(
                  'Gemischte Fragen aus allen Kapiteln, Schwerpunkt Anwendung und Transfer.',
                  'Mixed questions from all chapters, focused on application and transfer.',
                )}
                {boss && (
                  <>
                    {' '}
                    {tr('Bestwert:', 'Best:')} {pct(boss.best)} ({boss.attempts}×)
                  </>
                )}
              </p>
              {allDone ? (
                <a className="btn primary" href={href({ name: 'boss', courseId: id })}>
                  {boss ? tr('Nochmal kämpfen', 'Fight again') : tr('Kampf beginnen', 'Start the fight')}
                </a>
              ) : (
                <p className="muted small">
                  {tr(
                    'Wird freigeschaltet, wenn alle Kapitel gemeistert sind.',
                    'Unlocks once all chapters are mastered.',
                  )}
                </p>
              )}
            </div>
          </li>
        )}
      </ol>

      <ObjectiveInsights courseId={id} />

      <section className="card stack">
        <h3>{tr('Prüfungstermin', 'Exam date')}</h3>
        <div className="row gap wrap">
          <input
            type="date"
            className="input"
            value={course.examDate ?? ''}
            onChange={async (e) => {
              await db.courses.update(id, { examDate: e.target.value || undefined });
              await retuneSchedules(id);
            }}
          />
          {course.examDate && (
            <span className="muted">
              {(() => {
                const n = Math.max(0, Math.ceil((new Date(course.examDate).getTime() - Date.now()) / 86400000));
                const days = plural(n, 'Tag', 'Tage', 'day', 'days');
                if (n < 7) return tr(`noch ${days}`, `${days} left`);
                const w = Math.floor(n / 7);
                const rest = n % 7;
                const weeks =
                  plural(w, 'Woche', 'Wochen', 'week', 'weeks') +
                  (rest ? ` ${tr('und', 'and')} ${plural(rest, 'Tag', 'Tage', 'day', 'days')}` : '');
                return tr(`noch ${days} · ${weeks}`, `${days} left · ${weeks}`);
              })()}
            </span>
          )}
        </div>
      </section>

      {flagged.length > 0 && (
        <section className="card stack">
          <h3>
            {tr('Ausgeblendete Fragen', 'Hidden questions')} ({flagged.length})
          </h3>
          <p className="muted small">
            {tr(
              'Diese Fragen sind aus der Wiederholung genommen. Korrigiere sie und gib sie damit wieder frei, oder gib sie unverändert frei.',
              'These questions are excluded from review. Fix them, which also releases them, or release them unchanged.',
            )}
          </p>
          <ul className="flag-list">
            {flagged.map((c) => {
              const q = findQuestion(c.chapterId, c.questionId);
              if (editingCard === c.id && q) {
                return (
                  <li key={c.id}>
                    <QuestionEditor
                      question={q}
                      onCancel={() => setEditingCard(undefined)}
                      onSave={async (edited) => {
                        await updateQuestion(c.chapterId, edited);
                        await unflagCard(c.id);
                        setEditingCard(undefined);
                      }}
                    />
                  </li>
                );
              }
              return (
                <li key={c.id}>
                  <span className="grow">
                    {questionText(c.chapterId, c.questionId)} <em className="muted small">– {c.flagged}</em>
                  </span>
                  {q && (
                    <button className="btn small" onClick={() => setEditingCard(c.id)}>
                      {tr('Bearbeiten', 'Edit')}
                    </button>
                  )}
                  <button className="btn small" onClick={() => unflagCard(c.id)}>
                    {tr('Freigeben', 'Release')}
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <button
        className="btn danger ghost self-start"
        onClick={async () => {
          if (
            confirm(
              tr(
                `Kurs „${course.title}“ mit allen Kapiteln und deinem Fortschritt löschen?`,
                `Delete course "${course.title}" with all chapters and your progress?`,
              ),
            )
          ) {
            await deleteCourse(id);
            go({ name: 'home' });
          }
        }}
      >
        {tr('Kurs löschen', 'Delete course')}
      </button>
    </div>
  );
}
