import { useState } from 'react';
import { downloadBlob, exportBackup, importBackup } from '../lib/backup';
import { db } from '../lib/db';
import { dayKey } from '../lib/progress';

export default function DataPage() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  async function doExport() {
    downloadBlob(await exportBackup(), `lorebook-sicherung-${dayKey()}.json`);
    setMsg({ ok: true, text: 'Sicherung heruntergeladen.' });
  }

  async function doImport(f?: File) {
    if (!f) return;
    if (!confirm('Die Sicherung ersetzt alle Kurse und deinen Fortschritt in diesem Browser. Fortfahren?')) return;
    try {
      await importBackup(await f.text());
      setMsg({ ok: true, text: 'Sicherung wiederhergestellt.' });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  async function wipe() {
    if (!confirm('Wirklich ALLE Daten (Kurse, PDFs, Fortschritt) in diesem Browser löschen? Mit Account werden Kurse und Fortschritt beim nächsten Login wieder geladen.')) return;
    await db.delete();
    location.href = '/';
  }

  return (
    <div className="stack">
      <h1>Daten &amp; Sicherung</h1>
      <section className="card stack">
        <h3>Wo liegen meine Daten?</h3>
        <p>
          In diesem Browser (IndexedDB). Mit einem <a href="#/account">Account</a> werden Kurse und Fortschritt zusätzlich in der Cloud
          gesichert und auf deine anderen Geräte übertragen. Ohne Account sind die Daten weg, wenn du den Browserspeicher löschst.
        </p>
        <p className="muted small">Die Sicherungsdatei funktioniert auch ohne Account. PDFs sind weder in der Sicherung noch in der Cloud enthalten.</p>
      </section>
      <section className="card stack">
        <h3>Sicherung</h3>
        <div className="row gap wrap">
          <button className="btn primary" onClick={doExport}>Sicherung herunterladen</button>
          <label className="btn">
            Sicherung einspielen
            <input type="file" accept=".json,application/json" hidden onChange={(e) => doImport(e.target.files?.[0])} />
          </label>
        </div>
        {msg && <p className={msg.ok ? 'success' : 'error'}>{msg.text}</p>}
      </section>
      <section className="card stack">
        <h3>Alles löschen</h3>
        <button className="btn danger self-start" onClick={wipe}>Alle Daten löschen</button>
      </section>
    </div>
  );
}
