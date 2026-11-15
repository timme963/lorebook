import { useState } from 'react';
import { downloadBlob, exportBackup, importBackup } from '../lib/backup';
import { db } from '../lib/db';
import { dayKey } from '../lib/progress';
import { isNative } from '../lib/platform';
import ReminderSettings from '../components/ReminderSettings';
import { tr } from '../lib/i18n';

export default function DataPage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  async function doExport() {
    try {
      await downloadBlob(await exportBackup(), `${tr('lorebook-sicherung', 'lorebook-backup')}-${dayKey()}.json`);
      setMsg({ ok: true, text: isNative ? tr('Sicherung erstellt.', 'Backup created.') : tr('Sicherung heruntergeladen.', 'Backup downloaded.') });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  async function doImport(f?: File) {
    if (!f) return;
    if (!confirm(tr('Die Sicherung ersetzt alle Kurse und deinen Fortschritt in diesem Browser. Fortfahren?', 'The backup replaces all courses and your progress in this browser. Continue?'))) return;
    try {
      await importBackup(await f.text());
      setMsg({ ok: true, text: tr('Sicherung wiederhergestellt.', 'Backup restored.') });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  async function wipe() {
    if (!confirm(
        tr(
          'Wirklich ALLE Daten (Kurse, PDFs, Fortschritt) in diesem Browser löschen? Mit Account werden Kurse und Fortschritt beim nächsten Login wieder geladen.',
          'Really delete ALL data (courses, PDFs, progress) in this browser? With an account, courses and progress are restored at the next sign-in.',
        ),
      )) return;
    await db.delete();
    location.href = '/';
  }

  return (
    <div className="stack">
      <h1>{tr('Daten & Sicherung', 'Data & backup')}</h1>
      <section className="card stack">
        <h3>{tr('Wo liegen meine Daten?', 'Where is my data?')}</h3>
        {tr(
          <p>
            In diesem Browser (IndexedDB). Mit einem <a href="#/account">Account</a> werden Kurse und Fortschritt zusätzlich in der Cloud
            gesichert und auf deine anderen Geräte übertragen. Ohne Account sind die Daten weg, wenn du den Browserspeicher löschst.
          </p>,
          <p>
            In this browser (IndexedDB). With an <a href="#/account">account</a>, courses and progress are also backed up to the cloud and
            synced to your other devices. Without an account, the data is gone if you clear the browser storage.
          </p>,
        )}
        <p className="muted small">{tr('Die Sicherungsdatei funktioniert auch ohne Account. PDFs sind weder in der Sicherung noch in der Cloud enthalten.', 'The backup file works without an account too. PDFs are included neither in the backup nor in the cloud.')}</p>
      </section>
      {isNative && <ReminderSettings />}
      <section className="card stack">
        <h3>{tr('Sicherung', 'Backup')}</h3>
        <div className="row gap wrap">
          <button className="btn primary" onClick={doExport}>{tr('Sicherung herunterladen', 'Download backup')}</button>
          <label className="btn">
            {tr('Sicherung einspielen', 'Restore backup')}
            <input type="file" accept=".json,application/json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
          </label>
        </div>
        {msg && <p className={msg.ok ? 'success' : 'error'}>{msg.text}</p>}
      </section>
      <section className="card stack">
        <h3>{tr('Alles löschen', 'Delete everything')}</h3>
        <button className="btn danger self-start" onClick={wipe}>{tr('Alle Daten löschen', 'Delete all data')}</button>
      </section>
    </div>
  );
}
