import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { deleteChapter, deleteCourse, resetChapter, type BossResult } from '../lib/courses';
import { db, getMeta, type ChapterRow } from '../lib/db';
import { dueCards, unflagCard } from '../lib/srs';
import { go, href } from '../router';

const PHASE_LABEL: Record<ChapterRow['phase'], string> = {
  new: 'Neu',
  pretest: 'Vorabfragen',
  story: 'Story',
  posttest: 'Nachfragen',
  done: 'Gemeistert',
};

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
      db.cards.where('courseId').equals(id).filter((c) => !!c.flagged).toArray(),
    ]);
    return { course, chapters, due, pdf, boss, flagged };
  }, [id]);
  const [menu, setMenu] = useState<string>();

  if (!data) return null;
  if (!data.course) {
    return (
      <div className="card empty">
        <h2>Kurs nicht gefunden</h2>
        <a className="btn" href={href({ name: 'home' })}>Zur Übersicht</a>
      </div>
    );
  }
  const { course, chapters, due, pdf, boss, flagged } = data;
  const allDone = chapters.length > 0 && chapters.every((c) => c.phase === 'done');

  async function onPdf(f?: File) {
    if (!f) return;
    await db.pdfs.put({ courseId: id, name: f.name, blob: f });
  }

  function questionText(chapterId: string, questionId: string): string {
    const ch = chapters!.find((c) => c.id === chapterId);
    const q = ch && [...ch.content.pretest, ...ch.content.posttest, ...ch.content.review].find((x) => x.id === questionId);
    return q?.prompt ?? questionId;
  }

  return (
    <div className="stack">
      <a className="back" href={href({ name: 'home' })}>← Übersicht</a>
      <div className="row between wrap gap">
        <div>
          <h1>{course.title}</h1>
          {course.source && <p className="muted small">{course.source}</p>}
        </div>
        <div className="row gap wrap">
          {due.length > 0 && <a className="btn primary" href={href({ name: 'review', courseId: id })}>↻ {due.length} wiederholen</a>}
          <a className="btn" href={href({ name: 'import', courseId: id })}>+ Kapitel</a>
        </div>
      </div>

      <section className="card row between wrap gap">
        <div>
          <strong>PDF für Quellenansicht</strong>
          <p className="muted small">{pdf ? `📎 ${pdf.name} (bleibt nur in diesem Browser)` : 'Optional: Mit PDF springt „Quelle anzeigen“ direkt zur Originalseite.'}</p>
        </div>
        <div className="row gap">
          <label className="btn small">
            {pdf ? 'Ersetzen' : 'PDF hinzufügen'}
            <input type="file" accept="application/pdf" hidden onChange={(e) => onPdf(e.target.files?.[0])} />
          </label>
          {pdf && <button className="btn small ghost" onClick={() => db.pdfs.delete(id)}>Entfernen</button>}
        </div>
      </section>

      <h2>Quest-Karte</h2>
      {chapters.length === 0 && <p className="muted">Noch keine Kapitel. Importiere das erste.</p>}
      <ol className="quest-map">
        {chapters.map((ch, i) => {
          const locked = i > 0 && chapters[i - 1].phase !== 'done';
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
                      {PHASE_LABEL[ch.phase]} · S. {ch.content.pages[0]}–{ch.content.pages[1]} · {ch.verified ? '✓ geprüft' : '⚠ ungeprüft'}
                      {ch.phase === 'done' && <> · vorher {pct(ch.preScore)} → nachher {pct(ch.postScore)}</>}
                    </p>
                  </div>
                  <button className="btn small ghost" onClick={() => setMenu(menu === ch.id ? undefined : ch.id)} aria-label="Optionen">⋯</button>
                </div>
                {menu === ch.id && (
                  <div className="row gap wrap menu">
                    <button className="btn small" onClick={() => resetChapter(ch.id)}>Ablauf neu starten</button>
                    <button
                      className="btn small danger"
                      onClick={() => {
                        if (confirm(`Kapitel „${ch.content.title}“ samt Wiederholungskarten löschen?`)) deleteChapter(ch.id);
                      }}
                    >
                      Löschen
                    </button>
                    {ch.verificationNotes.length > 0 && (
                      <details className="small">
                        <summary>Prüfnotizen</summary>
                        <ul>{ch.verificationNotes.map((n, j) => <li key={j}>{n}</li>)}</ul>
                      </details>
                    )}
                  </div>
                )}
                {!locked && (
                  <a className={`btn ${ch.phase === 'done' ? 'small' : 'primary'}`} href={href({ name: 'chapter', id: ch.id })}>
                    {ch.phase === 'new' ? 'Starten' : ch.phase === 'done' ? 'Story nochmal lesen' : 'Weitermachen'}
                  </a>
                )}
                {locked && <p className="muted small">Wird nach Kapitel {chapters[i - 1].number} freigeschaltet.</p>}
              </div>
            </li>
          );
        })}
        {chapters.length > 0 && (
          <li className={`quest boss ${allDone ? '' : 'locked'}`}>
            <div className="quest-node">⚔</div>
            <div className="card quest-card">
              <h3>Boss-Fight: Alles gemischt</h3>
              <p className="muted small">
                Gemischte Fragen aus allen Kapiteln, Schwerpunkt Anwendung und Transfer.
                {boss && <> Bestwert: {pct(boss.best)} ({boss.attempts}×)</>}
              </p>
              {allDone ? (
                <a className="btn primary" href={href({ name: 'boss', courseId: id })}>{boss ? 'Nochmal kämpfen' : 'Kampf beginnen'}</a>
              ) : (
                <p className="muted small">Wird freigeschaltet, wenn alle Kapitel gemeistert sind.</p>
              )}
            </div>
          </li>
        )}
      </ol>

      <section className="card stack">
        <h3>Prüfungstermin</h3>
        <div className="row gap wrap">
          <input
            type="date"
            className="input"
            value={course.examDate ?? ''}
            onChange={(e) => db.courses.update(id, { examDate: e.target.value || undefined })}
          />
          {course.examDate && (
            <span className="muted">
              noch {Math.max(0, Math.ceil((new Date(course.examDate).getTime() - Date.now()) / 86400000))} Tage
            </span>
          )}
        </div>
      </section>

      {flagged.length > 0 && (
        <section className="card stack">
          <h3>Gemeldete Fragen ({flagged.length})</h3>
          <p className="muted small">Diese Fragen sind aus der Wiederholung genommen. Korrigiere sie über einen erneuten Import des Kapitels oder gib sie wieder frei.</p>
          <ul className="flag-list">
            {flagged.map((c) => (
              <li key={c.id}>
                <span className="grow">{questionText(c.chapterId, c.questionId)} <em className="muted small">– {c.flagged}</em></span>
                <button className="btn small" onClick={() => unflagCard(c.id)}>Freigeben</button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <button
        className="btn danger ghost self-start"
        onClick={async () => {
          if (confirm(`Kurs „${course.title}“ mit allen Kapiteln und deinem Fortschritt löschen?`)) {
            await deleteCourse(id);
            go({ name: 'home' });
          }
        }}
      >
        Kurs löschen
      </button>
    </div>
  );
}
