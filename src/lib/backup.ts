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

interface BackupFile {
  app: 'lorebook';
  backupVersion: 1;
  data: Partial<Record<string, unknown>>;
}

function parseBackup(text: string): BackupFile {
  const payload = JSON.parse(text) as Partial<BackupFile> | null;
  if (
    payload?.app !== 'lorebook' ||
    payload.backupVersion !== 1 ||
    typeof payload.data !== 'object' ||
    payload.data === null
  ) {
    throw new Error(tr('Das ist keine Lorebook-Sicherung.', 'This is not a Lorebook backup.'));
  }
  return { app: payload.app, backupVersion: payload.backupVersion, data: payload.data };
}

export async function importBackup(text: string): Promise<void> {
  const payload = parseBackup(text);
  await db.transaction('rw', [...TABLES.map((t) => db.table(t)), db.tombstones], async () => {
    for (const t of TABLES) {
      const rows = payload.data[t];
      if (!Array.isArray(rows)) continue;
      const table = db.table(t);
      if ((SYNC_TABLES as readonly string[]).includes(t)) {
        // delete row by row instead of clear(): this creates tombstones, so the cloud picks up the deletion
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

/** Browser: download. Android app: write the file to the cache and save/send it via the share sheet. */
export async function downloadBlob(
  blob: Blob,
  filename: string,
  title = tr('Lorebook-Sicherung', 'Lorebook backup'),
): Promise<void> {
  if (isNative) {
    const res = await Filesystem.writeFile({
      path: filename,
      data: await blob.text(),
      directory: Directory.Cache,
      encoding: Encoding.UTF8,
    });
    await Share.share({ title, files: [res.uri] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
