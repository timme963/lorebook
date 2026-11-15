import { useLiveQuery } from 'dexie-react-hooks';
import { getMeta } from './lib/db';
import { currentStreak, levelFor, type Streak } from './lib/progress';
import { countDue } from './lib/srs';
import { THEME_ICON, THEME_LABEL, useTheme } from './lib/theme';
import { href, useRoute } from './router';
import Home from './pages/Home';
import ImportPage from './pages/Import';
import CoursePage from './pages/Course';
import ChapterPage from './pages/Chapter';
import ReviewPage from './pages/Review';
import BossPage from './pages/Boss';
import DataPage from './pages/Data';
import HelpPage from './pages/Help';

function TopBar() {
  const xp = useLiveQuery(() => getMeta<number>('xp', 0), [], 0);
  const streak = useLiveQuery(() => getMeta<Streak>('streak', { count: 0, lastDay: null }), [], { count: 0, lastDay: null });
  const due = useLiveQuery(() => countDue(), [], 0);
  const lvl = levelFor(xp);
  const [theme, cycleTheme] = useTheme();
  return (
    <header className="topbar">
      <a className="brand" href={href({ name: 'home' })}>
        <img src="/icon.svg" alt="" width={28} height={28} />
        <span>Lorebook</span>
      </a>
      <nav className="topnav">
        <a href={href({ name: 'review' })} className="pill" title="Heute fällige Wiederholungen">
          ↻ <strong>{due}</strong>
        </a>
        <span className="pill" title="Lernserie (ein Tag Pause ist erlaubt)">
          🔥 <strong>{currentStreak(streak)}</strong>
        </span>
        <span className="pill" title={`${xp} XP`}>
          Lv <strong>{lvl.level}</strong>
        </span>
        <button type="button" className="pill theme-toggle" onClick={cycleTheme} title={`${THEME_LABEL[theme]} – klicken zum Wechseln`} aria-label={THEME_LABEL[theme]}>
          {THEME_ICON[theme]}
        </button>
        <a href={href({ name: 'help' })} className="pill" title="Hilfe">?</a>
      </nav>
    </header>
  );
}

export default function App() {
  const route = useRoute();
  let page;
  switch (route.name) {
    case 'home':
      page = <Home />;
      break;
    case 'import':
      page = <ImportPage courseId={route.courseId} />;
      break;
    case 'course':
      page = <CoursePage id={route.id} />;
      break;
    case 'chapter':
      page = <ChapterPage id={route.id} />;
      break;
    case 'review':
      page = <ReviewPage courseId={route.courseId} />;
      break;
    case 'boss':
      page = <BossPage courseId={route.courseId} />;
      break;
    case 'data':
      page = <DataPage />;
      break;
    case 'help':
      page = <HelpPage />;
      break;
  }
  return (
    <>
      <TopBar />
      <main className="container">{page}</main>
      <footer className="footer">
        <a href={href({ name: 'data' })}>Daten &amp; Sicherung</a>
        <span>·</span>
        <a href={href({ name: 'help' })}>So funktioniert's</a>
        <span>·</span>
        <span>Alle Daten bleiben in diesem Browser.</span>
      </footer>
    </>
  );
}
