import { useState } from 'react';
import { downloadBlob, exportBackup, importBackup } from '../lib/backup';
import { db } from '../lib/db';
import { dayKey } from '../lib/progress';
import { isNative } from '../lib/platform';
import { tr } from '../lib/i18n';

/** Building blocks of the "Account & data" page (see Account.tsx) */

export function BackupCard() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string }>();

  async function doExport() {
    try {
      await downloadBlob(await exportBackup(), `${tr('lorebook-sicherung', 'lorebook-backup')}-${dayKey()}.json`);
      setMsg({
        ok: true,
        text: isNative
          ? tr('Sicherung erstellt.', 'Backup created.')
          : tr('Sicherung heruntergeladen.', 'Backup downloaded.'),
      });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  async function doImport(input: HTMLInputElement) {
    const f = input.files?.[0];
    input.value = ''; // allow picking the same file again
    if (!f) return;
    if (
      !confirm(
        tr(
          'Die Sicherung ersetzt alle Kurse und deinen Fortschritt auf diesem Gerät. Fortfahren?',
          'The backup replaces all courses and your progress on this device. Continue?',
        ),
      )
    )
      return;
    try {
      await importBackup(await f.text());
      setMsg({ ok: true, text: tr('Sicherung wiederhergestellt.', 'Backup restored.') });
    } catch (e) {
      setMsg({ ok: false, text: (e as Error).message });
    }
  }

  return (
    <section className="card stack">
      <h3>{tr('Sicherungsdatei', 'Backup file')}</h3>
      <p className="muted small">
        {tr(
          'Funktioniert auch ohne Account. Enthält Kurse und Fortschritt, aber keine PDFs.',
          'Works without an account too. Contains courses and progress, but no PDFs.',
        )}
      </p>
      <div className="row gap wrap">
        <button className="btn primary" onClick={doExport}>
          {tr('Sicherung herunterladen', 'Download backup')}
        </button>
        <label className="btn">
          {tr('Sicherung einspielen', 'Restore backup')}
          <input type="file" accept=".json,application/json" hidden onChange={(e) => doImport(e.currentTarget)} />
        </label>
      </div>
      {msg && <p className={msg.ok ? 'success' : 'error'}>{msg.text}</p>}
    </section>
  );
}

export function WipeCard({ signedIn }: { signedIn: boolean }) {
  async function wipe() {
    const text = signedIn
      ? tr(
          'Wirklich ALLE Daten (Kurse, PDFs, Fortschritt) auf diesem Gerät löschen? Kurse und Fortschritt werden danach aus deinem Account wieder geladen, PDFs nicht.',
          'Really delete ALL data (courses, PDFs, progress) on this device? Courses and progress are then reloaded from your account, PDFs are not.',
        )
      : tr(
          'Wirklich ALLE Daten (Kurse, PDFs, Fortschritt) auf diesem Gerät löschen? Ohne Account lässt sich das nur mit einer Sicherungsdatei rückgängig machen.',
          'Really delete ALL data (courses, PDFs, progress) on this device? Without an account, this can only be undone with a backup file.',
        );
    if (!confirm(text)) return;
    await db.delete();
    location.href = '/';
  }

  return (
    <section className="card stack">
      <h3>{tr('Daten auf diesem Gerät löschen', 'Delete data on this device')}</h3>
      <button className="btn danger self-start" onClick={wipe}>
        {tr('Alle Daten auf diesem Gerät löschen', 'Delete all data on this device')}
      </button>
    </section>
  );
}
