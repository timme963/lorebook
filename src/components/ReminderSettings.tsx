import { useEffect, useState } from 'react';
import { getReminder, setReminder, testReminder, type ReminderSettings as Settings } from '../lib/reminders';

/** Nur in der Android-App: tägliche Erinnerung an fällige Wiederholungen. */
export default function ReminderSettings() {
  const [s, setS] = useState<Settings>();
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  useEffect(() => {
    getReminder().then(setS);
  }, []);

  async function save(next: Settings) {
    setMsg(undefined);
    try {
      const r = await setReminder(next);
      if (r === 'denied') {
        setMsg({ ok: false, text: 'Benachrichtigungen sind nicht erlaubt. Erlaube sie in den Android-Einstellungen für Lorebook.' });
        return;
      }
      setS(next);
      if (next.enabled) setMsg({ ok: true, text: `Erinnerung täglich um ${next.time} Uhr, wenn Karten fällig sind.` });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  if (!s) return null;
  return (
    <section className="card stack">
      <h3>Erinnerung</h3>
      <p className="muted small">Einmal am Tag eine Benachrichtigung, wie viele Karten fällig sind. An Tagen ohne fällige Karten kommt keine.</p>
      <label className="row gap">
        <input type="checkbox" checked={s.enabled} onChange={(e) => save({ ...s, enabled: e.target.checked })} />
        <span>Täglich erinnern um</span>
        <input className="input" style={{ width: 'auto' }} type="time" value={s.time} onChange={(e) => e.target.value && save({ ...s, time: e.target.value })} />
      </label>
      {s.enabled && (
        <button className="btn small ghost self-start" onClick={() => testReminder().catch((e) => setMsg({ ok: false, text: (e as Error).message }))}>
          Test-Benachrichtigung
        </button>
      )}
      {msg && <p className={`small ${msg.ok ? 'success' : 'error'}`}>{msg.text}</p>}
    </section>
  );
}
