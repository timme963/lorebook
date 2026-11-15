import { useState, type ReactNode } from 'react';
import { checkAuto } from '../lib/courses';
import type { AnswerRecord } from '../lib/db';
import { LEVEL_LABEL, type Question } from '../lib/schema';
import { SourceButton } from './Source';

interface Props {
  q: Question;
  courseId: string;
  /** silent = keine Auflösung (Vorabfragen), feedback = sofortige Auflösung */
  mode: 'silent' | 'feedback';
  onDone: (r: AnswerRecord) => void;
  /** Zusätzlicher Inhalt nach der Auflösung, z. B. Bewertungsknöpfe in der Wiederholung. Ersetzt dann den Weiter-Knopf. */
  after?: (r: AnswerRecord) => ReactNode;
  meta?: ReactNode;
}

export default function QuestionCard({ q, courseId, mode, onDone, after, meta }: Props) {
  const [given, setGiven] = useState('');
  const [record, setRecord] = useState<AnswerRecord>();
  const [revealed, setRevealed] = useState(false); // nur offene Fragen
  const [checked, setChecked] = useState<boolean[]>(() => (q.type === 'open' ? q.rubric.map(() => false) : []));

  function submit(value: string) {
    if (q.type === 'open') {
      if (mode === 'silent') return onDone({ given: value, correct: null, score: 0 });
      setRevealed(true);
      return;
    }
    const correct = value !== '' && checkAuto(q, value);
    const r: AnswerRecord = { given: value, correct, score: correct ? 1 : 0 };
    if (mode === 'silent') return onDone(r);
    setRecord(r);
  }

  function acceptSelfGrade() {
    if (q.type !== 'open') return;
    const score = checked.filter(Boolean).length / q.rubric.length;
    setRecord({ given, correct: null, score });
  }

  const locked = !!record || revealed;

  return (
    <article className="card question">
      <div className="q-meta">
        <span className={`tag level-${q.level}`}>{LEVEL_LABEL[q.level]}</span>
        {meta}
      </div>
      <h3 className="q-prompt">{q.type === 'cloze' ? q.prompt.replace('___', '_____') : q.prompt}</h3>

      {q.type === 'mc' && (
        <div className="options">
          {q.options.map((opt, i) => {
            let cls = 'option';
            if (record) {
              if (i === q.correct) cls += ' correct';
              else if (String(i) === record.given) cls += ' wrong';
            } else if (String(i) === given) cls += ' selected';
            return (
              <button key={i} type="button" className={cls} disabled={locked} onClick={() => (mode === 'silent' ? submit(String(i)) : setGiven(String(i)))}>
                <span className="opt-letter">{String.fromCharCode(65 + i)}</span>
                <span>{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {q.type === 'cloze' && (
        <form
          className="row gap"
          onSubmit={(e) => {
            e.preventDefault();
            if (given.trim()) submit(given.trim());
          }}
        >
          <input className="input grow" value={given} disabled={locked} onChange={(e) => setGiven(e.target.value)} placeholder="Deine Antwort" autoFocus />
        </form>
      )}

      {q.type === 'open' && (
        <textarea className="input" rows={4} value={given} disabled={locked} onChange={(e) => setGiven(e.target.value)} placeholder="Antworte in eigenen Worten. Stichpunkte reichen." />
      )}

      {!locked && (
        <div className="row gap wrap actions">
          {(q.type !== 'mc' || mode === 'feedback') && (
            <button className="btn primary" disabled={!given.trim()} onClick={() => submit(given.trim())}>
              {q.type === 'open' && mode === 'feedback' ? 'Musterantwort zeigen' : mode === 'silent' ? 'Weiter' : 'Prüfen'}
            </button>
          )}
          <button className="btn ghost" onClick={() => (q.type === 'open' && mode === 'feedback' ? submit('') : mode === 'silent' ? submit('') : setRecord({ given: '', correct: false, score: 0 }))}>
            Weiß ich nicht
          </button>
        </div>
      )}

      {q.type === 'open' && revealed && !record && (
        <div className="feedback neutral">
          <p className="label">Musterantwort</p>
          <p>{q.modelAnswer}</p>
          <p className="label">Welche Punkte hast du getroffen?</p>
          <div className="rubric">
            {q.rubric.map((r, i) => (
              <label key={i} className="check">
                <input type="checkbox" checked={checked[i]} onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))} />
                <span>{r}</span>
              </label>
            ))}
          </div>
          <button className="btn primary" onClick={acceptSelfGrade}>Bewertung übernehmen</button>
        </div>
      )}

      {record && (
        <div className={`feedback ${record.correct === null ? (record.score >= 0.75 ? 'good' : record.score >= 0.4 ? 'neutral' : 'bad') : record.correct ? 'good' : 'bad'}`}>
          <p className="verdict">
            {record.correct === null ? `${Math.round(record.score * 100)} % der Kernpunkte` : record.correct ? 'Richtig!' : 'Nicht ganz.'}
            {q.type === 'cloze' && !record.correct && <> Richtig wäre: <strong>{q.answers[0]}</strong></>}
          </p>
          {q.type === 'open' && record.given && (
            <p className="muted small">Deine Antwort: {record.given}</p>
          )}
          <p>{q.explanation}</p>
          <SourceButton courseId={courseId} source={q.source} />
          <div className="row gap wrap actions">
            {after ? after(record) : <button className="btn primary" onClick={() => onDone(record)} autoFocus>Weiter →</button>}
          </div>
        </div>
      )}
    </article>
  );
}
