import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { importChapter, moveCourse, sortCourses, toggleStar } from '../lib/courses';
import { db, type CourseRow } from '../lib/db';
import { demoChapter, findDemoCourse, localizeDemo } from '../lib/demo';
import { plural, tr } from '../lib/i18n';
import { currentStreak, levelFor, levelTitle, totalXp } from '../lib/progress';
import { dueCards } from '../lib/srs';
import { go, href } from '../router';

export default function Home() {
  const data = useLiveQuery(async () => {
    const [courses, chapters, due, xp, streak] = await Promise.all([
      db.courses.toArray(),
      db.chapters.toArray(),
      dueCards(),
      totalXp(),
      currentStreak(),
    ]);
    return { courses: sortCourses(courses), chapters, due, xp, streak };
  });
  const [loadingDemo, setLoadingDemo] = useState(false);
  const [reordering, setReordering] = useState(false);

  if (!data) return null;
  const { courses, chapters, due, xp, streak } = data;
  const lvl = levelFor(xp);

  async function loadDemo() {
    setLoadingDemo(true);
    const existing = await findDemoCourse();
    if (existing) {
      await localizeDemo();
      return go({ name: 'course', id: existing });
    }
    const { course } = await importChapter(demoChapter());
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
              <span className="muted small">
                {xp} / {lvl.next} XP
              </span>
            </div>
            <div className="bar">
              <div style={{ width: `${Math.round(lvl.progress * 100)}%` }} />
            </div>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <span className="big">{due.length}</span>
            <span className="muted small">{tr('heute fällig', 'due today')}</span>
          </div>
          <div>
            <span className="big">{streak}</span>
            <span className="muted small">{tr('Tage Serie', 'day streak')}</span>
          </div>
          <div>
            <span className="big">{chapters.filter((c) => c.phase === 'done').length}</span>
            <span className="muted small">{tr('Kapitel gemeistert', 'chapters mastered')}</span>
          </div>
        </div>
        {due.length > 0 && (
          <a className="btn primary block" href={href({ name: 'review' })}>
            {tr(`Jetzt ${due.length} Wiederholungen machen`, `Do ${due.length} reviews now`)}
          </a>
        )}
      </section>

      <div className="row between">
        <h2>{tr('Deine Kurse', 'Your courses')}</h2>
        <div className="row gap wrap">
          {courses.length > 1 && (
            <button className={`btn ${reordering ? 'primary' : 'ghost'}`} onClick={() => setReordering((r) => !r)}>
              {reordering ? tr('Fertig', 'Done') : tr('↕ Sortieren', '↕ Reorder')}
            </button>
          )}
          <a className="btn" href={href({ name: 'import' })}>
            {tr('+ Kapitel importieren', '+ Import chapter')}
          </a>
        </div>
      </div>

      {courses.length === 0 && (
        <section className="card empty">
          <h3>{tr('Noch keine Kurse', 'No courses yet')}</h3>
          {tr(
            <p>
              So geht's: Du lädst dein PDF bei Claude, ChatGPT oder Gemini hoch und kopierst einen fertigen Prompt aus
              Lorebook dazu. Die Antwort fügst du hier ein. Daraus wird pro Kapitel:{' '}
              <strong>Vorabfragen → Story → Nachfragen → Wiederholung</strong>.
            </p>,
            <p>
              How it works: upload your PDF to Claude, ChatGPT or Gemini and add a ready-made prompt from Lorebook.
              Paste the answer here. Each chapter becomes:{' '}
              <strong>pre-questions → story → post-questions → review</strong>.
            </p>,
          )}
          <div className="row gap wrap">
            <a className="btn primary" href={href({ name: 'import' })}>
              {tr('Erstes Kapitel importieren', 'Import first chapter')}
            </a>
            <button className="btn" onClick={loadDemo} disabled={loadingDemo}>
              {tr('Demo-Kapitel ausprobieren', 'Try the demo chapter')}
            </button>
          </div>
        </section>
      )}

      <div className="grid">
        {courses.map((c, i) => {
          const chs = chapters.filter((ch) => ch.courseId === c.id);
          const done = chs.filter((ch) => ch.phase === 'done').length;
          const dueHere = due.filter((d) => d.courseId === c.id).length;
          // moving stays within the starred or the unstarred group
          const sameGroup = (other: CourseRow | undefined) => other !== undefined && !!other.starred === !!c.starred;
          const canUp = sameGroup(courses[i - 1]);
          const canDown = sameGroup(courses[i + 1]);
          return (
            <div key={c.id} className={`card course-card${c.starred ? ' starred' : ''}`}>
              <div className="row between gap">
                <h3>
                  <a className="course-link" href={href({ name: 'course', id: c.id })}>
                    {c.title}
                  </a>
                </h3>
                <button
                  className="star-btn"
                  aria-pressed={!!c.starred}
                  title={
                    c.starred ? tr('Stern entfernen', 'Remove star') : tr('Mit Stern nach oben', 'Star and pin to top')
                  }
                  onClick={() => toggleStar(c.id)}
                >
                  {c.starred ? '★' : '☆'}
                </button>
              </div>
              <p className="muted small">
                {plural(chs.length, 'Kapitel', 'Kapitel', 'chapter', 'chapters')} · {done}{' '}
                {tr('abgeschlossen', 'completed')}
                {dueHere ? ` · ${dueHere} ${tr('fällig', 'due')}` : ''}
              </p>
              <div className="bar">
                <div style={{ width: chs.length ? `${(done / chs.length) * 100}%` : '0%' }} />
              </div>
              {reordering && (
                <div className="row gap reorder">
                  <button
                    className="btn small"
                    disabled={!canUp}
                    onClick={() => moveCourse(c.id, -1)}
                    aria-label={tr(`${c.title} nach oben`, `Move ${c.title} up`)}
                  >
                    ↑
                  </button>
                  <button
                    className="btn small"
                    disabled={!canDown}
                    onClick={() => moveCourse(c.id, 1)}
                    aria-label={tr(`${c.title} nach unten`, `Move ${c.title} down`)}
                  >
                    ↓
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
