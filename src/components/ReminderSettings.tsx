import { useEffect, useState } from 'react';
import { tr } from '../lib/i18n';
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
        setMsg({ ok: false, text: tr('Benachrichtigungen sind nicht erlaubt. Erlaube sie in den Android-Einstellungen für Lorebook.', 'Notifications are not allowed. Allow them for Lorebook in the Android settings.') });
        return;
      }
      setS(next);
      if (next.enabled) setMsg({ ok: true, text: tr(`Erinnerung täglich um ${next.time} Uhr, wenn Karten fällig sind.`, `Daily reminder at ${next.time} when cards are due.`) });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  if (!s) return null;
  return (
    <section className="card stack">
      <h3>{tr('Erinnerung', 'Reminder')}</h3>
      <p className="muted small">{tr('Einmal am Tag eine Benachrichtigung, wie viele Karten fällig sind. An Tagen ohne fällige Karten kommt keine.', 'One notification a day with the number of due cards. None on days without due cards.')}</p>
      <label className="row gap">
        <input type="checkbox" checked={s.enabled} onChange={(e) => save({ ...s, enabled: e.target.checked })} />
        <span>{tr('Täglich erinnern um', 'Remind me daily at')}</span>
        <input className="input" style={{ width: 'auto' }} type="time" value={s.time} onChange={(e) => e.target.value && save({ ...s, time: e.target.value })} />
      </label>
      {s.enabled && (
        <button className="btn small ghost self-start" onClick={() => testReminder().catch((e) => setMsg({ ok: false, text: (e as Error).message }))}>
          {tr('Test-Benachrichtigung', 'Test notification')}
        </button>
      )}
      {msg && <p className={`small ${msg.ok ? 'success' : 'error'}`}>{msg.text}</p>}
    </section>
  );
}
