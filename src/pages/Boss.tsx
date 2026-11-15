import { useEffect, useState } from 'react';
import QuestionCard from '../components/QuestionCard';
import { buildBoss, type BossQuestion, type BossResult } from '../lib/courses';
import { db, getMeta, setMeta } from '../lib/db';
import { addXp } from '../lib/progress';
import { href } from '../router';

export default function BossPage({ courseId }: { courseId: string }) {
  const [questions, setQuestions] = useState<BossQuestion[]>();
  const [scores, setScores] = useState<number[]>([]);
  const [result, setResult] = useState<{ score: number; best: boolean; xp: number }>();

  async function start() {
    const chapters = (await db.chapters.where('courseId').equals(courseId).toArray()).filter((c) => c.phase === 'done');
    setScores([]);
    setResult(undefined);
    setQuestions(buildBoss(chapters));
  }

  useEffect(() => {
    start();
  }, [courseId]);

  if (!questions) return null;
  const back = href({ name: 'course', id: courseId });

  if (questions.length === 0) {
    return (
      <div className="card empty">
        <h2>Noch kein Boss</h2>
        <p>Schließe zuerst Kapitel ab.</p>
        <a className="btn" href={back}>Zurück</a>
      </div>
    );
  }

  async function answered(score: number) {
    const next = [...scores, score];
    setScores(next);
    if (next.length < questions!.length) return;
    const total = next.reduce((a, b) => a + b, 0) / next.length;
    let best = true;
    let xp = Math.round(total * 30);
    try {
      const prev = await getMeta<BossResult | null>(`boss:${courseId}`, null);
      best = !prev || total > prev.best;
      if (total >= 0.7 && (!prev || prev.best < 0.7)) xp = 100;
      await setMeta(`boss:${courseId}`, { best: Math.max(total, prev?.best ?? 0), last: total, at: Date.now(), attempts: (prev?.attempts ?? 0) + 1 });
      await addXp(xp);
    } catch (e) {
      console.error('[lorebook] Boss-Ergebnis speichern', e);
    } finally {
      setResult({ score: total, best, xp });
    }
  }

  if (result) {
    const won = result.score >= 0.7;
    return (
      <section className="card result">
        <p className="eyebrow">Boss-Fight</p>
        <h2>{won ? '⚔ Besiegt!' : 'Der Boss steht noch'}</h2>
        <div className="compare">
          <div><span className="big accent">{Math.round(result.score * 100)} %</span><span className="muted small">{result.best ? 'neuer Bestwert' : 'Ergebnis'}</span></div>
        </div>
        <p>{won ? 'Über 70 % – du kannst das Gelernte auch anwenden.' : 'Ab 70 % ist der Boss besiegt. Die Wiederholungen der nächsten Tage bringen dich dahin.'} +{result.xp} XP</p>
        <div className="row gap wrap center">
          <a className="btn primary" href={back}>Zur Quest-Karte</a>
          <button className="btn" onClick={start}>Neuer Kampf (neue Fragen)</button>
        </div>
      </section>
    );
  }

  const i = scores.length;
  const current = questions[i];
  if (!current) {
    // letzte Frage beantwortet, Ergebnis wird gerade gespeichert
    return <section className="card result"><p className="muted">Auswertung …</p></section>;
  }
  const hp = 1 - scores.reduce((a, b) => a + b, 0) / questions.length;

  return (
    <div className="stack">
      <a className="back" href={back}>← Aufgeben</a>
      <div className="boss-bar">
        <span>⚔ Boss</span>
        <div className="bar hp"><div style={{ width: `${hp * 100}%` }} /></div>
        <span className="muted small">{i + 1} / {questions.length}</span>
      </div>
      <QuestionCard
        key={`${current.chapterId}:${current.q.id}`}
        q={current.q}
        courseId={courseId}
        mode="feedback"
        onDone={(r) => answered(r.score)}
        meta={<span className="muted small">{current.chapterTitle}</span>}
      />
    </div>
  );
}
