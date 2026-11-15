import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { importChapter } from '../lib/courses';
import { db } from '../lib/db';
import { DEMO_CHAPTER } from '../lib/demo';
import { currentStreak, levelFor, levelTitle, totalXp } from '../lib/progress';
import { dueCards } from '../lib/srs';
import { go, href } from '../router';

export default function Home() {
  const data = useLiveQuery(async () => {
    const [courses, chapters, due, xp, streak] = await Promise.all([
      db.courses.orderBy('createdAt').reverse().toArray(),
      db.chapters.toArray(),
      dueCards(),
      totalXp(),
      currentStreak(),
    ]);
    return { courses, chapters, due, xp, streak };
  });
  const [loadingDemo, setLoadingDemo] = useState(false);

  if (!data) return null;
  const { courses, chapters, due, xp, streak } = data;
  const lvl = levelFor(xp);

  async function loadDemo() {
    setLoadingDemo(true);
    const { course } = await importChapter(DEMO_CHAPTER);
    go({ name: 'course', id: course.id });
  }

  return (
    <div className="stack">
      <section className="hero card">
        <div className="hero-level">
          <div className="level-badge">{lvl.level}</div>
          <div className="grow">
            <div className="row between">
              <strong>{levelTitle(lvl.level)}</strong>
              <span className="muted small">{xp} / {lvl.next} XP</span>
            </div>
            <div className="bar"><div style={{ width: `${Math.round(lvl.progress * 100)}%` }} /></div>
          </div>
        </div>
        <div className="hero-stats">
          <div><span className="big">{due.length}</span><span className="muted small">heute fällig</span></div>
          <div><span className="big">{streak}</span><span className="muted small">Tage Serie</span></div>
          <div><span className="big">{chapters.filter((c) => c.phase === 'done').length}</span><span className="muted small">Kapitel gemeistert</span></div>
        </div>
        {due.length > 0 && (
          <a className="btn primary block" href={href({ name: 'review' })}>Jetzt {due.length} Wiederholungen machen</a>
        )}
      </section>

      <div className="row between">
        <h2>Deine Kurse</h2>
        <a className="btn" href={href({ name: 'import' })}>+ Kapitel importieren</a>
      </div>

      {courses.length === 0 && (
        <section className="card empty">
          <h3>Noch keine Kurse</h3>
          <p>
            So geht's: Du lädst dein PDF bei Claude, ChatGPT oder Gemini hoch und kopierst einen fertigen Prompt aus Lorebook dazu. Die Antwort
            fügst du hier ein. Daraus wird pro Kapitel: <strong>Vorabfragen → Story → Nachfragen → Wiederholung</strong>.
          </p>
          <div className="row gap wrap">
            <a className="btn primary" href={href({ name: 'import' })}>Erstes Kapitel importieren</a>
            <button className="btn" onClick={loadDemo} disabled={loadingDemo}>Demo-Kapitel ausprobieren</button>
          </div>
        </section>
      )}

      <div className="grid">
        {courses.map((c) => {
          const chs = chapters.filter((ch) => ch.courseId === c.id);
          const done = chs.filter((ch) => ch.phase === 'done').length;
          const dueHere = due.filter((d) => d.courseId === c.id).length;
          return (
            <a key={c.id} className="card course-card" href={href({ name: 'course', id: c.id })}>
              <h3>{c.title}</h3>
              <p className="muted small">{chs.length} Kapitel · {done} abgeschlossen{dueHere ? ` · ${dueHere} fällig` : ''}</p>
              <div className="bar"><div style={{ width: chs.length ? `${(done / chs.length) * 100}%` : '0%' }} /></div>
            </a>
          );
        })}
      </div>
    </div>
  );
}
