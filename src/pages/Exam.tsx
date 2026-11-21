import { useCallback, useEffect, useRef, useState } from 'react';
import ExamAnswer from '../components/ExamAnswer';
import Rich from '../components/Rich';
import { db } from '../lib/db';
import {
  autoScore,
  buildExam,
  EXAM_SIZES,
  finishExam,
  gradeFor,
  PASS_MARK,
  timeLimitMinutes,
  type ExamQuestion,
} from '../lib/exam';
import { tr } from '../lib/i18n';
import { correctSet, parseGiven, type Question } from '../lib/schema';
import { href } from '../router';

type Phase = 'setup' | 'running' | 'grading' | 'submitting' | 'result';

interface Outcome {
  scores: number[];
  xp: number;
  best: boolean;
}

const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

function formatClock(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / SECOND_MS));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** The given answer as readable text for the review list. */
function givenText(q: Question, given: string): string {
  if (!given.trim()) return tr('keine Antwort', 'no answer');
  if (q.type === 'mc')
    return parseGiven(given)
      .map((i) => String.fromCharCode(65 + i))
      .join(', ');
  return given;
}

function correctText(q: Question): string {
  if (q.type === 'mc')
    return correctSet(q)
      .map((i) => `${String.fromCharCode(65 + i)}: ${q.options[i] ?? ''}`)
      .join(' · ');
  if (q.type === 'cloze') return q.answers[0] ?? '';
  return q.modelAnswer;
}

export default function ExamPage({ courseId }: { courseId: string }) {
  const [available, setAvailable] = useState<number>();
  const [phase, setPhase] = useState<Phase>('setup');
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [confirming, setConfirming] = useState(false);
  // self-assessment of open questions: ticked rubric points per question index
  const [rubricChecks, setRubricChecks] = useState<Record<number, boolean[]>>({});
  const [outcome, setOutcome] = useState<Outcome>();
  const [error, setError] = useState<string>();
  // set synchronously, so a double click or the running clock cannot score the same attempt twice
  const submitting = useRef(false);
  const back = href({ name: 'course', id: courseId });

  useEffect(() => {
    db.chapters
      .where('courseId')
      .equals(courseId)
      .toArray()
      .then(
        (chs) => setAvailable(buildExam(chs, Number.MAX_SAFE_INTEGER).length),
        (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
      );
  }, [courseId]);

  async function start(size: number) {
    const chapters = await db.chapters.where('courseId').equals(courseId).toArray();
    const picked = buildExam(chapters, size);
    setQuestions(picked);
    setAnswers(picked.map(() => ''));
    setRubricChecks({});
    setIndex(0);
    setOutcome(undefined);
    setConfirming(false);
    setError(undefined);
    submitting.current = false;
    setDeadline(Date.now() + timeLimitMinutes(picked) * MINUTE_MS);
    setPhase('running');
  }

  const score = useCallback(
    async (checks: Record<number, boolean[]>) => {
      if (submitting.current) return;
      submitting.current = true;
      const previousPhase = phase;
      setPhase('submitting');
      setError(undefined);
      const scores = questions.map((e, i) => {
        const auto = autoScore(e.q, answers[i] ?? '');
        if (auto !== undefined) return auto;
        const ticked = checks[i] ?? [];
        return e.q.type === 'open' ? ticked.filter(Boolean).length / e.q.rubric.length : 0;
      });
      try {
        const { xp, best } = await finishExam(courseId, questions, scores);
        setOutcome({ scores, xp, best });
        setPhase('result');
      } catch (e) {
        // back to where the student was, with the answers intact, so they can try again
        submitting.current = false;
        setError(e instanceof Error ? e.message : String(e));
        setPhase(previousPhase === 'running' ? 'grading' : previousPhase);
      }
    },
    [answers, courseId, phase, questions],
  );

  const handIn = useCallback(() => {
    setConfirming(false);
    if (questions.some((e) => e.q.type === 'open')) setPhase('grading');
    else void score({});
  }, [questions, score]);

  // the clock ticks while the exam runs; at zero the exam is handed in as it stands
  const handInRef = useRef(handIn);
  useEffect(() => {
    handInRef.current = handIn;
  }, [handIn]);
  useEffect(() => {
    if (phase !== 'running') return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= deadline) handInRef.current();
    }, SECOND_MS);
    return () => clearInterval(timer);
  }, [phase, deadline]);

  if (error && available === undefined) return <p className="error">{error}</p>;
  if (available === undefined) return null;

  if (phase === 'submitting') {
    return (
      <section className="card result">
        <p className="muted">{tr('Auswertung …', 'Scoring …')}</p>
      </section>
    );
  }

  if (phase === 'setup') {
    return (
      <section className="card stack">
        <a className="back" href={back}>
          {tr('← Zurück', '← Back')}
        </a>
        <h1>{tr('Probeklausur', 'Mock exam')}</h1>
        {available === 0 ? (
          <p>
            {tr(
              'Schließe zuerst mindestens ein Kapitel ab – die Klausur nimmt Fragen aus allen abgeschlossenen Kapiteln.',
              'Complete at least one chapter first – the exam uses questions from all completed chapters.',
            )}
          </p>
        ) : (
          <>
            <p>
              {tr(
                'Gemischte Fragen aus allen abgeschlossenen Kapiteln, mit Zeitlimit und ohne Auflösung zwischendurch. Du kannst zwischen den Fragen springen und Antworten bis zur Abgabe ändern. Am Ende gibt es Punkte und eine geschätzte Note; was nicht ganz richtig war, kommt in die nächste Wiederholung.',
                'Mixed questions from all completed chapters, with a time limit and no feedback in between. You can jump between questions and change answers until you hand in. At the end you get points and an estimated grade; anything not fully right goes into your next review.',
              )}
            </p>
            <div className="row gap wrap">
              {EXAM_SIZES.filter((size, i) => i === 0 || size <= available).map((size) => {
                const n = Math.min(size, available);
                return (
                  <button key={size} className="btn primary" onClick={() => start(n)}>
                    {tr(`${n} Fragen`, `${n} questions`)}
                  </button>
                );
              })}
            </div>
            <p className="muted small">
              {tr(
                '1,5 Minuten pro Auswahl- oder Lückenfrage, 4 Minuten pro offener Frage.',
                '1.5 minutes per choice or cloze question, 4 minutes per open question.',
              )}
            </p>
          </>
        )}
      </section>
    );
  }

  if (phase === 'running') {
    const current = questions[index];
    if (!current) return null;
    const left = deadline - now;
    const unanswered = answers.filter((a) => !a.trim()).length;
    return (
      <div className="stack">
        <div className="exam-bar">
          <strong>{tr('Probeklausur', 'Mock exam')}</strong>
          <span className={`exam-clock${left < 2 * MINUTE_MS ? ' urgent' : ''}`} aria-live="off">
            ⏱ {formatClock(left)}
          </span>
        </div>
        <nav className="exam-nav" aria-label={tr('Fragen', 'Questions')}>
          {questions.map((e, i) => (
            <button
              key={`${e.chapterId}:${e.q.id}`}
              className={`exam-pill${i === index ? ' current' : ''}${answers[i]?.trim() ? ' answered' : ''}`}
              onClick={() => setIndex(i)}
              aria-label={tr(`Frage ${i + 1}`, `Question ${i + 1}`)}
            >
              {i + 1}
            </button>
          ))}
        </nav>
        <section className="card stack">
          <p className="muted small">
            {tr(`Frage ${index + 1} von ${questions.length}`, `Question ${index + 1} of ${questions.length}`)} ·{' '}
            {current.chapterTitle}
          </p>
          <h3 className="q-prompt">
            <Rich text={current.q.type === 'cloze' ? current.q.prompt.replace('___', '_____') : current.q.prompt} />
          </h3>
          <ExamAnswer
            key={`${current.chapterId}:${current.q.id}`}
            q={current.q}
            given={answers[index] ?? ''}
            onChange={(given) => setAnswers((a) => a.map((x, i) => (i === index ? given : x)))}
          />
          <div className="row between gap wrap">
            <button className="btn" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
              {tr('← Zurück', '← Previous')}
            </button>
            {index < questions.length - 1 ? (
              <button className="btn primary" onClick={() => setIndex((i) => i + 1)}>
                {tr('Weiter →', 'Next →')}
              </button>
            ) : (
              <button className="btn primary" onClick={() => setConfirming(true)}>
                {tr('Abgeben', 'Hand in')}
              </button>
            )}
          </div>
        </section>
        {confirming ? (
          <section className="card stack">
            <p>
              {unanswered > 0
                ? tr(
                    `${unanswered} Fragen sind noch unbeantwortet. Trotzdem abgeben?`,
                    `${unanswered} questions are still unanswered. Hand in anyway?`,
                  )
                : tr('Klausur jetzt abgeben?', 'Hand in the exam now?')}
            </p>
            <div className="row gap">
              <button className="btn primary" onClick={handIn}>
                {tr('Abgeben', 'Hand in')}
              </button>
              <button className="btn ghost" onClick={() => setConfirming(false)}>
                {tr('Weiter bearbeiten', 'Keep working')}
              </button>
            </div>
          </section>
        ) : (
          <button className="btn ghost self-start" onClick={() => setConfirming(true)}>
            {tr('Klausur abgeben', 'Hand in exam')}
          </button>
        )}
      </div>
    );
  }

  if (phase === 'grading') {
    // also reached after a failed save, then possibly without any open question to rate
    const hasOpen = questions.some((e) => e.q.type === 'open');
    return (
      <div className="stack">
        <h1>{hasOpen ? tr('Offene Fragen bewerten', 'Rate the open questions') : tr('Abgabe', 'Hand-in')}</h1>
        {hasOpen && (
          <p className="muted">
            {tr(
              'Vergleiche deine Antworten mit der Musterantwort und hake ab, welche Punkte du getroffen hast.',
              'Compare your answers with the model answer and tick the points you covered.',
            )}
          </p>
        )}
        {questions.map((e, i) =>
          e.q.type !== 'open' ? null : (
            <section key={`${e.chapterId}:${e.q.id}`} className="card stack">
              <h3 className="q-prompt">
                <Rich text={e.q.prompt} />
              </h3>
              <p className="small">
                <strong>{tr('Deine Antwort:', 'Your answer:')}</strong> {givenText(e.q, answers[i] ?? '')}
              </p>
              <p className="small">
                <strong>{tr('Musterantwort:', 'Model answer:')}</strong> <Rich text={e.q.modelAnswer} />
              </p>
              <div className="rubric">
                {e.q.rubric.map((point, j) => (
                  <label key={j} className="check">
                    <input
                      type="checkbox"
                      checked={rubricChecks[i]?.[j] ?? false}
                      onChange={(ev) =>
                        setRubricChecks((c) => {
                          const row = [...(c[i] ?? [])];
                          row[j] = ev.target.checked;
                          return { ...c, [i]: row };
                        })
                      }
                    />
                    <span>
                      <Rich text={point} />
                    </span>
                  </label>
                ))}
              </div>
            </section>
          ),
        )}
        {error && (
          <p className="error small">
            {tr('Speichern fehlgeschlagen:', 'Saving failed:')} {error}
          </p>
        )}
        <button className="btn primary self-start" onClick={() => score(rubricChecks)}>
          {tr('Auswerten', 'Score')}
        </button>
      </div>
    );
  }

  if (!outcome) return null;
  const total = outcome.scores.reduce((a, b) => a + b, 0) / Math.max(1, outcome.scores.length);
  const passed = total >= PASS_MARK;
  const byChapter = new Map<string, { id: string; title: string; sum: number; count: number }>();
  questions.forEach((e, i) => {
    const entry = byChapter.get(e.chapterId) ?? { id: e.chapterId, title: e.chapterTitle, sum: 0, count: 0 };
    entry.sum += outcome.scores[i] ?? 0;
    entry.count++;
    byChapter.set(e.chapterId, entry);
  });

  return (
    <div className="stack">
      <section className="card result">
        <p className="eyebrow">{tr('Probeklausur', 'Mock exam')}</p>
        <h2>{passed ? tr('Bestanden', 'Passed') : tr('Noch nicht bestanden', 'Not passed yet')}</h2>
        <div className="compare">
          <div>
            <span className="big accent">{gradeFor(total)}</span>
            <span className="muted small">{tr('geschätzte Note', 'estimated grade')}</span>
          </div>
          <div>
            <span className="big">{Math.round(total * 100)} %</span>
            <span className="muted small">
              {outcome.best ? tr('neuer Bestwert', 'new best') : tr('der Punkte', 'of the points')}
            </span>
          </div>
        </div>
        <p className="muted small">
          {tr(
            'Notenschätzung nach der üblichen Skala: ab 50 % bestanden (4,0), ab 95 % 1,0. Nicht ganz richtige Fragen kommen in deine nächste Wiederholung.',
            'Grade estimate on the usual German scale: 50 % passes (4.0), 95 % gives 1.0. Questions that were not fully right go into your next review.',
          )}{' '}
          +{outcome.xp} XP
        </p>
        <div className="row gap wrap center">
          <a className="btn primary" href={back}>
            {tr('Zur Kursseite', 'To the course')}
          </a>
          <button className="btn" onClick={() => setPhase('setup')}>
            {tr('Neue Probeklausur', 'New mock exam')}
          </button>
        </div>
      </section>

      {byChapter.size > 1 && (
        <section className="card stack">
          <h3>{tr('Nach Kapitel', 'By chapter')}</h3>
          <ul className="objective-list">
            {[...byChapter.values()].map((c) => (
              <li key={c.id}>
                <span className="grow">{c.title}</span>
                <strong>{Math.round((c.sum / c.count) * 100)} %</strong>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card stack">
        <h3>{tr('Alle Fragen', 'All questions')}</h3>
        <ol className="exam-review">
          {questions.map((e, i) => {
            const s = outcome.scores[i] ?? 0;
            return (
              <li key={`${e.chapterId}:${e.q.id}`} className={s >= 1 ? 'right' : s > 0 ? 'partly' : 'wrong'}>
                <p>
                  <strong>
                    <Rich text={e.q.prompt} />
                  </strong>{' '}
                  <span className="muted small">({Math.round(s * 100)} %)</span>
                </p>
                <p className="small">
                  {tr('Du:', 'You:')} {givenText(e.q, answers[i] ?? '')} · {tr('Richtig:', 'Correct:')}{' '}
                  <Rich text={correctText(e.q)} />
                </p>
                <p className="muted small">
                  <Rich text={e.q.explanation} />
                </p>
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}
