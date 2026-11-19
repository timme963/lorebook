import { useRef, useState, type ReactNode } from 'react';
import { checkAuto } from '../lib/courses';
import type { AnswerRecord } from '../lib/db';
import { correctSet, encodeGiven, isMulti, LEVEL_LABEL, mcScore, parseGiven, type Question } from '../lib/schema';
import { SourceButton } from './Source';
import { tr } from '../lib/i18n';
import { DictateButton, SpeakButton } from './Speech';
import Rich from './Rich';

interface Props {
  q: Question;
  courseId: string;
  /** silent = no feedback (pre-questions), feedback = immediate feedback */
  mode: 'silent' | 'feedback';
  onDone: (r: AnswerRecord) => void;
  /** Extra content after the feedback, e.g. rating buttons in review. Replaces the Next button. */
  after?: (r: AnswerRecord) => ReactNode;
  meta?: ReactNode;
}

export default function QuestionCard({ q, courseId, mode, onDone, after, meta }: Props) {
  const [given, setGiven] = useState('');
  const [record, setRecord] = useState<AnswerRecord>();
  const [revealed, setRevealed] = useState(false); // open questions only
  const [checked, setChecked] = useState<boolean[]>(() => (q.type === 'open' ? q.rubric.map(() => false) : []));
  // a double click must not report an answer twice (double XP, chapter completed twice)
  const doneRef = useRef(false);
  const finish = (r: AnswerRecord) => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone(r);
  };

  function submit(value: string) {
    if (q.type === 'open') {
      if (mode === 'silent') return finish({ given: value, correct: null, score: 0 });
      setRevealed(true);
      return;
    }
    const correct = value !== '' && checkAuto(q, value);
    const score = q.type === 'mc' ? mcScore(q, value) : correct ? 1 : 0;
    const r: AnswerRecord = { given: value, correct, score };
    if (mode === 'silent') return finish(r);
    setRecord(r);
  }

  function acceptSelfGrade() {
    if (q.type !== 'open') return;
    const score = checked.filter(Boolean).length / q.rubric.length;
    setRecord({ given, correct: null, score });
  }

  const locked = !!record || revealed;
  const multi = q.type === 'mc' && isMulti(q);
  const right = q.type === 'mc' ? correctSet(q) : [];
  const picked = parseGiven(record ? record.given : given);
  const multiHint = tr('Mehrere Antworten möglich', 'More than one answer possible');

  function clickOption(i: number) {
    if (multi) return setGiven(encodeGiven(picked.includes(i) ? picked.filter((x) => x !== i) : [...picked, i]));
    if (mode === 'silent') return submit(String(i));
    setGiven(String(i));
  }

  // read-aloud text: the question, "blank" for cloze, lettered options for multiple choice
  const promptText =
    (q.type === 'cloze' ? q.prompt.replace('___', tr(' … Lücke … ', ' … blank … ')) : q.prompt) +
    (q.type === 'mc' ? ' ' + q.options.map((o, i) => `${String.fromCharCode(65 + i)}: ${o}.`).join(' ') : '') +
    (multi ? ` ${multiHint}.` : '');

  return (
    <article className="card question">
      <div className="q-meta">
        <span className={`tag level-${q.level}`}>{LEVEL_LABEL()[q.level]}</span>
        {meta}
      </div>
      <div className="row between gap">
        <h3 className="q-prompt">
          <Rich text={q.type === 'cloze' ? q.prompt.replace('___', '_____') : q.prompt} />
        </h3>
        <SpeakButton text={promptText} />
      </div>
      {multi && <p className="multi-hint">☑ {multiHint}</p>}

      {q.type === 'mc' && (
        <div className="options">
          {q.options.map((opt, i) => {
            let cls = multi ? 'option multi' : 'option';
            if (record) {
              const isRight = right.includes(i);
              const chosen = picked.includes(i);
              if (isRight) cls += chosen || !multi ? ' correct' : ' correct missed';
              else if (chosen) cls += ' wrong';
            } else if (picked.includes(i)) cls += ' selected';
            return (
              <button
                key={i}
                type="button"
                className={cls}
                disabled={locked}
                aria-pressed={multi ? picked.includes(i) : undefined}
                onClick={() => clickOption(i)}
              >
                <span className="opt-letter">{multi && picked.includes(i) ? '✓' : String.fromCharCode(65 + i)}</span>
                <span>
                  <Rich text={opt} />
                  {record && multi && right.includes(i) && !picked.includes(i) && (
                    <em className="missed-label"> – {tr('übersehen', 'missed')}</em>
                  )}
                </span>
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
          <input
            className="input grow"
            value={given}
            disabled={locked}
            onChange={(e) => setGiven(e.target.value)}
            placeholder={tr('Deine Antwort', 'Your answer')}
            autoFocus
          />
          <DictateButton value={given} onChange={setGiven} langHint={q.prompt} disabled={locked} />
        </form>
      )}

      {q.type === 'open' && (
        <div className="stack">
          <textarea
            className="input"
            rows={4}
            value={given}
            disabled={locked}
            onChange={(e) => setGiven(e.target.value)}
            placeholder={tr(
              'Antworte in eigenen Worten – tippen oder 🎤 einsprechen. Stichpunkte reichen.',
              'Answer in your own words – type or 🎤 speak. Bullet points are fine.',
            )}
          />
          {!locked && (
            <div className="row gap">
              <DictateButton value={given} onChange={setGiven} langHint={q.prompt} />
            </div>
          )}
        </div>
      )}

      {!locked && (
        <div className="row gap wrap actions">
          {(q.type !== 'mc' || mode === 'feedback' || multi) && (
            <button className="btn primary" disabled={!given.trim()} onClick={() => submit(given.trim())}>
              {q.type === 'open' && mode === 'feedback'
                ? tr('Musterantwort zeigen', 'Show model answer')
                : mode === 'silent'
                  ? tr('Weiter', 'Next')
                  : tr('Prüfen', 'Check')}
            </button>
          )}
          <button
            className="btn ghost"
            onClick={() =>
              q.type === 'open' && mode === 'feedback'
                ? submit('')
                : mode === 'silent'
                  ? submit('')
                  : setRecord({ given: '', correct: false, score: 0 })
            }
          >
            {tr('Weiß ich nicht', "Don't know")}
          </button>
        </div>
      )}

      {q.type === 'open' && revealed && !record && (
        <div className="feedback neutral">
          <p className="label">{tr('Musterantwort', 'Model answer')}</p>
          <div className="row between gap">
            <p>
              <Rich text={q.modelAnswer} />
            </p>
            <SpeakButton text={q.modelAnswer} />
          </div>
          <p className="label">{tr('Welche Punkte hast du getroffen?', 'Which points did you cover?')}</p>
          <div className="rubric">
            {q.rubric.map((r, i) => (
              <label key={i} className="check">
                <input
                  type="checkbox"
                  checked={checked[i]}
                  onChange={(e) => setChecked((c) => c.map((v, j) => (j === i ? e.target.checked : v)))}
                />
                <span>
                  <Rich text={r} />
                </span>
              </label>
            ))}
          </div>
          <button className="btn primary" onClick={acceptSelfGrade}>
            {tr('Bewertung übernehmen', 'Apply rating')}
          </button>
        </div>
      )}

      {record && (
        <div
          className={`feedback ${record.correct === null ? (record.score >= 0.75 ? 'good' : record.score >= 0.4 ? 'neutral' : 'bad') : record.correct ? 'good' : 'bad'}`}
        >
          <p className="verdict">
            {record.correct === null
              ? tr(
                  `${Math.round(record.score * 100)} % der Kernpunkte`,
                  `${Math.round(record.score * 100)} % of key points`,
                )
              : record.correct
                ? tr('Richtig!', 'Correct!')
                : multi && record.score > 0
                  ? tr(
                      `Teilweise richtig (${Math.round(record.score * 100)} %).`,
                      `Partly correct (${Math.round(record.score * 100)} %).`,
                    )
                  : tr('Nicht ganz.', 'Not quite.')}
            {multi && !record.correct && (
              <>
                {' '}
                {tr('Richtig sind:', 'Correct are:')}{' '}
                <strong>{right.map((i) => String.fromCharCode(65 + i)).join(', ')}</strong>
              </>
            )}
            {q.type === 'cloze' && !record.correct && (
              <>
                {' '}
                {tr('Richtig wäre:', 'Correct would be:')} <strong>{q.answers[0]}</strong>
              </>
            )}
          </p>
          {q.type === 'open' && record.given && (
            <p className="muted small">
              {tr('Deine Antwort:', 'Your answer:')} {record.given}
            </p>
          )}
          <div className="row between gap">
            <p>
              <Rich text={q.explanation} />
            </p>
            <SpeakButton text={(q.type === 'cloze' && !record.correct ? `${q.answers[0]}. ` : '') + q.explanation} />
          </div>
          <SourceButton courseId={courseId} source={q.source} />
          <div className="row gap wrap actions">
            {after ? (
              after(record)
            ) : (
              <button className="btn primary" onClick={() => finish(record)} autoFocus>
                {tr('Weiter →', 'Next →')}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
