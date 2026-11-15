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
    if (!confirm('Wirklich ALLE Daten (Kurse, PDFs, Fortschritt) in diesem Browser löschen?')) return;
    await db.delete();
    location.href = '/';
  }

  return (
    <div className="stack">
      <h1>Daten &amp; Sicherung</h1>
      <section className="card stack">
        <h3>Wo liegen meine Daten?</h3>
        <p>
          Ausschließlich in diesem Browser auf diesem Gerät (IndexedDB). Es gibt keinen Server und keinen Account. Wenn du den Browserspeicher
          löschst, sind die Daten weg. Mach deshalb ab und zu eine Sicherung.
        </p>
        <p className="muted small">Auf ein anderes Gerät umziehen: hier exportieren, dort importieren. PDFs sind nicht in der Sicherung enthalten.</p>
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
