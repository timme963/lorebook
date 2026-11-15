import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { db } from './db';
import { isNative } from './platform';

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
    throw new Error('Das ist keine Lorebook-Sicherung.');
  }
  await db.transaction('rw', TABLES.map((t) => db.table(t)), async () => {
    for (const t of TABLES) {
      const rows = payload.data[t];
      if (!Array.isArray(rows)) continue;
      await db.table(t).clear();
      await db.table(t).bulkPut(rows);
    }
  });
}

/** Browser: Download. Android-App: Datei im Cache ablegen und über „Teilen“ speichern/versenden. */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  if (isNative) {
    const res = await Filesystem.writeFile({ path: filename, data: await blob.text(), directory: Directory.Cache, encoding: Encoding.UTF8 });
    await Share.share({ title: 'Lorebook-Sicherung', files: [res.uri] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
