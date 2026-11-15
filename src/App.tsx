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
import { setLang, tr, useLang } from './lib/i18n';

const SYNC_ICON = { off: '☁', idle: '☁', syncing: '⟳', offline: '☁', error: '⚠', conflict: '⚠' } as const;
const SYNC_TITLE = () =>
  ({
    off: tr('Nicht angemeldet – Daten nur in diesem Browser', 'Not signed in – data only in this browser'),
    idle: tr('Synchronisiert', 'Synced'),
    syncing: tr('Synchronisiert …', 'Syncing …'),
    offline: tr('Offline – Sync wird nachgeholt', 'Offline – will sync later'),
    error: tr('Sync-Fehler', 'Sync error'),
    conflict: tr('Sync wartet auf deine Entscheidung', 'Sync is waiting for your decision'),
  }) as const;

function TopBar() {
  const xp = useLiveQuery(totalXp, [], 0);
  const streak = useLiveQuery(currentStreak, [], 0);
  const due = useLiveQuery(() => countDue(), [], 0);
  const lvl = levelFor(xp);
  const [theme, cycleTheme] = useTheme();
  const sync = useSyncStatus();
  const lang = useLang();
  const syncTitle = SYNC_TITLE()[sync.state];
  return (
    <header className="topbar">
      <a className="brand" href={href({ name: 'home' })}>
        <img src="/icon.svg" alt="" width={28} height={28} />
        <span>Lorebook</span>
      </a>
      <nav className="topnav">
        <a href={href({ name: 'review' })} className="pill" title={tr('Heute fällige Wiederholungen', 'Reviews due today')}>
          ↻ <strong>{due}</strong>
        </a>
        <span className="pill" title={tr('Lernserie (ein Tag Pause ist erlaubt)', 'Study streak (one day off is allowed)')}>
          🔥 <strong>{streak}</strong>
        </span>
        <span className="pill" title={`${xp} XP`}>
          Lv <strong>{lvl.level}</strong>
        </span>
        <a href={href({ name: 'account' })} className={`pill sync sync-${sync.state}`} title={syncTitle} aria-label={syncTitle}>
          {SYNC_ICON[sync.state]}
        </a>
        <button type="button" className="pill theme-toggle" onClick={cycleTheme} title={`${THEME_LABEL()[theme]} – ${tr('klicken zum Wechseln', 'click to change')}`} aria-label={THEME_LABEL()[theme]}>
          {THEME_ICON[theme]}
        </button>
        <button
          type="button"
          className="pill lang-toggle"
          onClick={() => setLang(lang === 'de' ? 'en' : 'de')}
          title={lang === 'de' ? 'Switch to English' : 'Auf Deutsch umschalten'}
          aria-label={lang === 'de' ? 'Switch to English' : 'Auf Deutsch umschalten'}
        >
          {lang === 'de' ? 'EN' : 'DE'}
        </button>
        <a href={href({ name: 'help' })} className="pill" title={tr('Hilfe', 'Help')}>?</a>
      </nav>
    </header>
  );
}

export default function App() {
  const route = useRoute();
  const sync = useSyncStatus();
  useLang(); // beim Umschalten alles neu rendern
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
        <a href={href({ name: 'data' })}>{tr('Daten & Sicherung', 'Data & backup')}</a>
        <span>·</span>
        <a href={href({ name: 'help' })}>{tr("So funktioniert's", 'How it works')}</a>
        <span>·</span>
        {!isNative && (
          <>
            <a href={APK_URL}>{tr('Android-App', 'Android app')}</a>
            <span>·</span>
          </>
        )}
        <a href={href({ name: 'impressum' })}>{tr('Impressum', 'Legal notice')}</a>
        <span>·</span>
        <a href={href({ name: 'datenschutz' })}>{tr('Datenschutz', 'Privacy')}</a>
        <span>·</span>
        <span>{sync.state === 'off'
            ? tr('Ohne Account bleiben alle Daten in diesem Browser.', 'Without an account, all data stays in this browser.')
            : tr('PDFs bleiben immer nur auf diesem Gerät.', 'PDFs always stay on this device only.')}</span>
      </footer>
    </>
  );
}
