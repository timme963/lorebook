import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db, SYNC_TABLES } from './db';
import { isNative } from './platform';
import { tr } from './i18n';

const TABLES = ['courses', 'chapters', 'cards', 'reviews', 'meta'] as const;

export async function exportBackup(): Promise<Blob> {
  const data: Record<string, unknown[]> = {};
  for (const t of TABLES) data[t] = await db.table(t).toArray();
  const payload = { app: 'lorebook', backupVersion: 1, exportedAt: new Date().toISOString(), data };
  return new Blob([JSON.stringify(payload)], { type: 'application/json' });
}

export async function importBackup(text: string): Promise<void> {
  const payload = JSON.parse(text);
  if (payload?.app !== 'lorebook' || payload.backupVersion !== 1 || typeof payload.data !== 'object') {
    throw new Error(tr('Das ist keine Lorebook-Sicherung.', 'This is not a Lorebook backup.'));
  }
  await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.tombstones], async () => {
    for (const t of TABLES) {
      const rows = payload.data[t];
      if (!Array.isArray(rows)) continue;
      const table = db.table(t);
      if ((SYNC_TABLES as readonly string[]).includes(t)) {
        // Einzeln löschen statt clear(): so entstehen Lösch-Markierungen und die Cloud übernimmt die Löschung
        const pk = table.schema.primKey.keyPath as string;
        const keep = new Set(rows.map((r: Record<string, unknown>) => String(r[pk])));
        const existing = (await table.toCollection().primaryKeys()) as string[];
        await table.bulkDelete(existing.filter((k) => !keep.has(String(k))));
      } else {
        await table.clear();
      }
      await table.bulkPut(rows);
    }
  });
}

/** Browser: Download. Android-App: Datei im Cache ablegen und über „Teilen“ speichern/versenden. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isNative) {
    const res = await Filesystem.writeFile({ path: filename, data: await blob.text(), directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: tr('Lorebook-Sicherung', 'Lorebook backup'), files: [res.uri] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
