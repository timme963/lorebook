import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { clearLocalSyncedData, deleteAccount, signOut, syncNow, useSyncStatus } from '../lib/sync';
import { href } from '../router';
import { isNative, PUBLIC_URL } from '../lib/platform';

function timeAgo(ms?: number): string {
  if (!ms) return 'noch nie';
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return 'gerade eben';
  if (s < 3600) return `vor ${Math.round(s / 60)} min`;
  if (s < 86400) return `vor ${Math.round(s / 3600)} h`;
  return new Date(ms).toLocaleString('de-DE');
}

const STATE_LABEL = {
  off: 'nicht angemeldet',
  idle: 'synchronisiert',
  syncing: 'synchronisiert gerade …',
  offline: 'offline – wird nachgeholt',
  error: 'Fehler beim Synchronisieren',
  conflict: 'wartet auf deine Entscheidung',
} as const;

const AUTH_ERRORS: [RegExp, string][] = [
  [/invalid login credentials/i, 'E-Mail oder Passwort falsch.'],
  [/email not confirmed/i, 'E-Mail noch nicht bestätigt. Klick zuerst den Link in der Bestätigungsmail.'],
  [/already registered|already been registered/i, 'Für diese E-Mail gibt es schon einen Account. Melde dich an.'],
  [/signups? not allowed|signup is disabled/i, 'Neue Registrierungen sind abgeschaltet.'],
  [/password should be at least/i, 'Das Passwort muss mindestens 8 Zeichen haben.'],
  [/rate limit|too many/i, 'Zu viele Versuche. Bitte kurz warten.'],
];

function authError(msg: string): string {
  return AUTH_ERRORS.find(([re]) => re.test(msg))?.[1] ?? msg;
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
        setInfo('Fast geschafft: Wir haben dir eine Bestätigungsmail geschickt. Klick den Link darin und melde dich danach hier an.');
        setMode('login');
      }
    }
    setBusy(false);
  }

  return (
    <section className="card stack">
      <div className="row gap">
        <button type="button" className={`btn small ${mode === 'login' ? 'primary' : 'ghost'}`} onClick={() => setMode('login')}>Anmelden</button>
        <button type="button" className={`btn small ${mode === 'signup' ? 'primary' : 'ghost'}`} onClick={() => setMode('signup')}>Account erstellen</button>
      </div>
      <form className="stack" onSubmit={submit}>
        <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="deine@email.de" />
        <input
          className="input"
          type="password"
          required
          minLength={8}
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'login' ? 'Passwort' : 'Passwort (mind. 8 Zeichen)'}
        />
        <button className="btn primary self-start" disabled={busy || !email.includes('@') || password.length < (mode === 'signup' ? 8 : 1)}>
          {mode === 'login' ? 'Anmelden' : 'Account erstellen'}
        </button>
      </form>
      {mode === 'signup' && (
        <p className="muted small">
          Mit dem Account gelten die Hinweise in der <a href={href({ name: 'datenschutz' })}>Datenschutzerklärung</a>.
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
        <p>
          Mit Account werden deine <strong>Kurse und dein Lernfortschritt</strong> gesichert und zwischen deinen Geräten abgeglichen. PDFs bleiben
          immer nur auf dem jeweiligen Gerät. Ohne Account funktioniert alles wie bisher, nur eben ausschließlich in diesem Browser.
        </p>
      </section>

      {status.state === 'off' ? (
        <Login />
      ) : (
        <section className="card stack">
          <div className="row between wrap gap">
            <div>
              <strong>{status.email}</strong>
              <p className={`small ${status.state === 'error' ? 'error' : 'muted'}`}>
                {STATE_LABEL[status.state]} · zuletzt {timeAgo(status.lastSync)}
              </p>
            </div>
            <button className="btn" disabled={busy || status.state === 'syncing' || status.state === 'conflict'} onClick={() => run(syncNow)}>
              ↻ Jetzt synchronisieren
            </button>
          </div>
          {status.state === 'error' && status.error && <p className="error small">{status.error}</p>}

          {status.state === 'conflict' && (
            <div className="feedback neutral">
              <p className="verdict">Auf diesem Gerät liegen Daten eines anderen Accounts.</p>
              <p className="small">Damit nichts vermischt wird, synchronisiert Lorebook erst, wenn du entscheidest.</p>
              <div className="row gap wrap">
                <button
                  className="btn primary"
                  disabled={busy}
                  onClick={() => run(async () => { await clearLocalSyncedData(); await syncNow(); }, 'Daten dieses Accounts geladen.')}
                >
                  Lokale Daten löschen und diesen Account laden
                </button>
                <button className="btn" disabled={busy} onClick={() => run(signOut)}>Abmelden</button>
              </div>
            </div>
          )}

          <div className="row gap wrap">
            <button className="btn ghost" disabled={busy} onClick={() => run(signOut)}>Abmelden</button>
          </div>
          <p className="muted small">Beim Abmelden bleiben die Daten auf diesem Gerät erhalten.</p>
        </section>
      )}

      {status.state !== 'off' && (
        <section className="card stack">
          <h3>Account löschen</h3>
          <p className="muted small">
            Löscht deinen Account und alles, was dazu in der Cloud gespeichert ist, sofort und endgültig. Die Daten auf diesem Gerät bleiben, bis du sie
            unter <a href={href({ name: 'data' })}>Daten &amp; Sicherung</a> löschst.
          </p>
          <button
            className="btn danger self-start"
            disabled={busy}
            onClick={() => {
              if (confirm('Account und alle Cloud-Daten unwiderruflich löschen? Andere Geräte werden dann nicht mehr synchronisiert.')) {
                run(deleteAccount, 'Account gelöscht. Die Daten auf diesem Gerät sind noch da.');
              }
            }}
          >
            Account löschen
          </button>
        </section>
      )}

      <p className="muted small">
        <a href={href({ name: 'datenschutz' })}>Datenschutzerklärung</a> · <a href={href({ name: 'impressum' })}>Impressum</a>
      </p>

      {msg && <p className="small">{msg}</p>}
    </div>
  );
}
