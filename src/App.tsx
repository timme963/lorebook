import { useLiveQuery } from 'dexie-react-hooks';
import { currentStreak, levelFor, totalXp } from './lib/progress';
import { countDue } from './lib/srs';
import { useSyncStatus } from './lib/sync';
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
import AccountPage from './pages/Account';
import { DatenschutzPage, ImpressumPage } from './pages/Legal';
import UpdateBanner from './components/UpdateBanner';
import { APK_URL, isNative } from './lib/platform';

const SYNC_ICON = { off: '☁', idle: '☁', syncing: '⟳', offline: '☁', error: '⚠', conflict: '⚠' } as const;
const SYNC_TITLE = {
  off: 'Nicht angemeldet – Daten nur in diesem Browser',
  idle: 'Synchronisiert',
  syncing: 'Synchronisiert …',
  offline: 'Offline – Sync wird nachgeholt',
  error: 'Sync-Fehler',
  conflict: 'Sync wartet auf deine Entscheidung',
} as const;

function TopBar() {
  const xp = useLiveQuery(totalXp, [], 0);
  const streak = useLiveQuery(currentStreak, [], 0);
  const due = useLiveQuery(() => countDue(), [], 0);
  const lvl = levelFor(xp);
  const [theme, cycleTheme] = useTheme();
  const sync = useSyncStatus();
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
          🔥 <strong>{streak}</strong>
        </span>
        <span className="pill" title={`${xp} XP`}>
          Lv <strong>{lvl.level}</strong>
        </span>
        <a href={href({ name: 'account' })} className={`pill sync sync-${sync.state}`} title={SYNC_TITLE[sync.state]} aria-label={SYNC_TITLE[sync.state]}>
          {SYNC_ICON[sync.state]}
        </a>
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
  const sync = useSyncStatus();
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
    case 'account':
      page = <AccountPage />;
      break;
    case 'impressum':
      page = <ImpressumPage />;
      break;
    case 'datenschutz':
      page = <DatenschutzPage />;
      break;
  }
  return (
    <>
      <TopBar />
      <main className="container">
        <UpdateBanner />
        {page}
      </main>
      <footer className="footer">
        <a href={href({ name: 'account' })}>Account &amp; Sync</a>
        <span>·</span>
        <a href={href({ name: 'data' })}>Daten &amp; Sicherung</a>
        <span>·</span>
        <a href={href({ name: 'help' })}>So funktioniert's</a>
        <span>·</span>
        {!isNative && (
          <>
            <a href={APK_URL}>Android-App</a>
            <span>·</span>
          </>
        )}
        <a href={href({ name: 'impressum' })}>Impressum</a>
        <span>·</span>
        <a href={href({ name: 'datenschutz' })}>Datenschutz</a>
        <span>·</span>
        <span>{sync.state === 'off' ? 'Ohne Account bleiben alle Daten in diesem Browser.' : 'PDFs bleiben immer nur auf diesem Gerät.'}</span>
      </footer>
    </>
  );
}
