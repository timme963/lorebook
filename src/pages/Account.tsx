import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { clearLocalSyncedData, deleteAccount, signOut, syncNow, useSyncStatus } from '../lib/sync';
import { href } from '../router';
import { isNative, PUBLIC_URL } from '../lib/platform';
import { locale, tr } from '../lib/i18n';

function timeAgo(ms?: number): string {
  if (!ms) return tr('noch nie', 'never');
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return tr('gerade eben', 'just now');
  if (s < 3600) return tr(`vor ${Math.round(s / 60)} min`, `${Math.round(s / 60)} min ago`);
  if (s < 86400) return tr(`vor ${Math.round(s / 3600)} h`, `${Math.round(s / 3600)} h ago`);
  return new Date(ms).toLocaleString(locale());
}

const STATE_LABEL = () =>
  ({
    off: tr('nicht angemeldet', 'not signed in'),
    idle: tr('synchronisiert', 'synced'),
    syncing: tr('synchronisiert gerade …', 'syncing …'),
    offline: tr('offline – wird nachgeholt', 'offline – will sync later'),
    error: tr('Fehler beim Synchronisieren', 'Sync error'),
    conflict: tr('wartet auf deine Entscheidung', 'waiting for your decision'),
  }) as const;

const AUTH_ERRORS = (): [RegExp, string][] => [
  [/invalid login credentials/i, tr('E-Mail oder Passwort falsch.', 'Wrong email or password.')],
  [/email not confirmed/i, tr('E-Mail noch nicht bestätigt. Klick zuerst den Link in der Bestätigungsmail.', 'Email not confirmed yet. Click the link in the confirmation email first.')],
  [/already registered|already been registered/i, tr('Für diese E-Mail gibt es schon einen Account. Melde dich an.', 'An account already exists for this email. Please sign in.')],
  [/signups? not allowed|signup is disabled/i, tr('Neue Registrierungen sind abgeschaltet.', 'New sign-ups are disabled.')],
  [/password should be at least/i, tr('Das Passwort muss mindestens 8 Zeichen haben.', 'The password must be at least 8 characters.')],
  [/rate limit|too many/i, tr('Zu viele Versuche. Bitte kurz warten.', 'Too many attempts. Please wait a moment.')],
];

function authError(msg: string): string {
  return AUTH_ERRORS().find(([re]) => re.test(msg))?.[1] ?? msg;
}

function Login() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [info, setInfo] = useState<string>();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    setInfo(undefined);
    if (mode === 'login') {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) setError(authError(error.message));
    } else {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: { emailRedirectTo: `${isNative ? PUBLIC_URL : location.origin}/#/account` },
      });
      if (error) setError(authError(error.message));
      else if (!data.session) {
        setInfo(
          tr(
            'Fast geschafft: Wir haben dir eine Bestätigungsmail geschickt. Klick den Link darin und melde dich danach hier an.',
            'Almost done: we sent you a confirmation email. Click the link in it, then sign in here.',
          ),
        );
        setMode('login');
      }
    }
    setBusy(false);
  }

  return (
    <section className="card stack">
      <div className="row gap">
        <button type="button" className={`btn small ${mode === 'login' ? 'primary' : 'ghost'}`} onClick={() => setMode('login')}>{tr('Anmelden', 'Sign in')}</button>
        <button type="button" className={`btn small ${mode === 'signup' ? 'primary' : 'ghost'}`} onClick={() => setMode('signup')}>{tr('Account erstellen', 'Create account')}</button>
      </div>
      <form className="stack" onSubmit={submit}>
        <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={tr('deine@email.de', 'you@example.com')} />
        <input
          className="input"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'login' ? tr('Passwort', 'Password') : tr('Passwort (mind. 8 Zeichen)', 'Password (min. 8 characters)')}
        />
        <button className="btn primary self-start" disabled={busy || !email.includes('@') || password.length < (mode === 'signup' ? 8 : 1)}>
          {mode === 'login' ? tr('Anmelden', 'Sign in') : tr('Account erstellen', 'Create account')}
        </button>
      </form>
      {mode === 'signup' && (
        <p className="muted small">
          {tr('Mit dem Account gelten die Hinweise in der', 'With an account, the')} <a href={href({ name: 'datenschutz' })}>{tr('Datenschutzerklärung', 'privacy policy')}</a>
          {tr('.', ' applies.')}
        </p>
      )}
      {info && <p className="success">{info}</p>}
      {error && <p className="error">{error}</p>}
    </section>
  );
}

export default function AccountPage() {
  const status = useSyncStatus();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>();

  async function run(fn: () => Promise<void>, done?: string) {
    setBusy(true);
    setMsg(undefined);
    try {
      await fn();
      if (done) setMsg(done);
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <h1>Account &amp; Sync</h1>
      <section className="card stack">
        {tr(
          <p>
            Mit Account werden deine <strong>Kurse und dein Lernfortschritt</strong> gesichert und zwischen deinen Geräten abgeglichen. PDFs bleiben
            immer nur auf dem jeweiligen Gerät. Ohne Account funktioniert alles wie bisher, nur eben ausschließlich in diesem Browser.
          </p>,
          <p>
            With an account, your <strong>courses and learning progress</strong> are backed up and synced between your devices. PDFs always stay
            on the device they were added on. Without an account, everything works the same – just only in this browser.
          </p>,
        )}
      </section>

      {status.state === 'off' ? (
        <Login />
      ) : (
        <section className="card stack">
          <div className="row between wrap gap">
            <div>
              <strong>{status.email}</strong>
              <p className={`small ${status.state === 'error' ? 'error' : 'muted'}`}>
                {STATE_LABEL()[status.state]} · {tr('zuletzt', 'last')} {timeAgo(status.lastSync)}
              </p>
            </div>
            <button className="btn" disabled={busy || status.state === 'syncing' || status.state === 'conflict'} onClick={() => run(syncNow)}>
              ↻ {tr('Jetzt synchronisieren', 'Sync now')}
            </button>
          </div>
          {status.state === 'error' && status.error && <p className="error small">{status.error}</p>}

          {status.state === 'conflict' && (
            <div className="feedback neutral">
              <p className="verdict">{tr('Auf diesem Gerät liegen Daten eines anderen Accounts.', 'This device holds data from another account.')}</p>
              <p className="small">{tr('Damit nichts vermischt wird, synchronisiert Lorebook erst, wenn du entscheidest.', 'To keep things from mixing, Lorebook won\'t sync until you decide.')}</p>
              <div className="row gap wrap">
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => run(async () => { await clearLocalSyncedData(); await syncNow(); }, tr('Daten dieses Accounts geladen.', 'This account\'s data loaded.'))}
                >
                  {tr('Lokale Daten löschen und diesen Account laden', 'Delete local data and load this account')}
                </button>
                <button className="btn" disabled={busy} onClick={() => run(signOut)}>{tr('Abmelden', 'Sign out')}</button>
              </div>
            </div>
          )}

          <div className="row gap wrap">
            <button className="btn ghost" disabled={busy} onClick={() => run(signOut)}>{tr('Abmelden', 'Sign out')}</button>
          </div>
          <p className="muted small">{tr('Beim Abmelden bleiben die Daten auf diesem Gerät erhalten.', 'Signing out keeps the data on this device.')}</p>
        </section>
      )}

      {status.state !== 'off' && (
        <section className="card stack">
          <h3>{tr('Account löschen', 'Delete account')}</h3>
          <p className="muted small">
            {tr(
              'Löscht deinen Account und alles, was dazu in der Cloud gespeichert ist, sofort und endgültig. Die Daten auf diesem Gerät bleiben, bis du sie löschst unter',
              'Deletes your account and everything stored for it in the cloud, immediately and permanently. The data on this device stays until you delete it under',
            )}{' '}
            <a href={href({ name: 'data' })}>{tr('Daten & Sicherung', 'Data & backup')}</a>.
          </p>
          <button
            className="btn danger self-start"
            disabled={busy}
            onClick={() => {
              if (confirm(tr('Account und alle Cloud-Daten unwiderruflich löschen? Andere Geräte werden dann nicht mehr synchronisiert.', 'Permanently delete your account and all cloud data? Other devices will no longer sync.'))) {
                run(deleteAccount, tr('Account gelöscht. Die Daten auf diesem Gerät sind noch da.', 'Account deleted. The data on this device is still there.'));
              }
            }}
          >
            {tr('Account löschen', 'Delete account')}
          </button>
        </section>
      )}

      <p className="muted small">
        <a href={href({ name: 'datenschutz' })}>{tr('Datenschutzerklärung', 'Privacy policy')}</a> · <a href={href({ name: 'impressum' })}>{tr('Impressum', 'Legal notice')}</a>
      </p>

      {msg && <p className="small">{msg}</p>}
    </div>
  );
}
