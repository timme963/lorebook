import { useState, type FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { clearLocalSyncedData, deleteCloudData, signOut, syncNow, useSyncStatus } from '../lib/sync';
import { href } from '../router';

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

function Login() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  async function send(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim() });
    setBusy(false);
    if (error) return setError(error.message);
    setSent(true);
  }

  async function verify(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(error.message.includes('expired') || error.message.includes('invalid') ? 'Code ungültig oder abgelaufen.' : error.message);
  }

  return (
    <section className="card stack">
      <h3>Anmelden</h3>
      <p className="muted">Ohne Passwort: Du bekommst einen Code per E-Mail.</p>
      {!sent ? (
        <form className="stack" onSubmit={send}>
          <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="deine@email.de" />
          <button className="btn primary self-start" disabled={busy || !email.includes('@')}>Code senden</button>
        </form>
      ) : (
        <form className="stack" onSubmit={verify}>
          <p className="small">Code an <strong>{email}</strong> geschickt. Schau auch im Spam-Ordner nach.</p>
          <input
            className="input code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            maxLength={10}
            autoFocus
          />
          <div className="row gap wrap">
            <button className="btn primary" disabled={busy || code.length < 6}>Anmelden</button>
            <button type="button" className="btn ghost" onClick={() => { setSent(false); setCode(''); }}>Andere E-Mail</button>
          </div>
        </form>
      )}
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
          <h3>Cloud-Daten löschen</h3>
          <p className="muted small">Löscht alles, was zu deinem Account in der Cloud gespeichert ist. Die Daten auf diesem Gerät bleiben, bis du sie unter <a href={href({ name: 'data' })}>Daten &amp; Sicherung</a> löschst.</p>
          <button
            className="btn danger self-start"
            disabled={busy}
            onClick={() => {
              if (confirm('Alle Cloud-Daten dieses Accounts unwiderruflich löschen? Andere Geräte laden sie dann nicht mehr.')) {
                run(async () => { await deleteCloudData(); await signOut(); }, 'Cloud-Daten gelöscht und abgemeldet.');
              }
            }}
          >
            Cloud-Daten löschen und abmelden
          </button>
        </section>
      )}

      {msg && <p className="small">{msg}</p>}
    </div>
  );
}
