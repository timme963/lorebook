import { useSyncExternalStore } from 'react';
import { exportBackup } from './backup';
import { db, getLocal, onLocalChange, setLocal, SYNC_TABLES, type SyncTable } from './db';
import { supabase } from './supabase';

// Lokal zuerst: IndexedDB bleibt die Hauptquelle. Der Sync gleicht Zeilen mit der Tabelle
// public.records ab. Konflikte: der höhere Änderungszeitstempel _ts gewinnt (auch serverseitig per Trigger).

const PK: Record<SyncTable, string> = { courses: 'id', chapters: 'id', cards: 'id', meta: 'key' };
const CHUNK = 200;
const PAGE = 500;
const PULL_OVERLAP_MS = 2 * 60 * 1000;

export interface SyncStatus {
  state: 'off' | 'idle' | 'syncing' | 'offline' | 'error' | 'conflict';
  email?: string;
  lastSync?: number;
  error?: string;
}

let status: SyncStatus = { state: 'off' };
const listeners = new Set<() => void>();

function setStatus(s: Partial<SyncStatus>) {
  status = { ...status, ...s };
  listeners.forEach((l) => l());
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => status,
  );
}

export interface RemoteRecord {
  tbl: SyncTable;
  id: string;
  data: Record<string, unknown> & { _ts?: number };
  deleted: boolean;
  updated_at: string;
}

async function push(userId: string): Promise<number> {
  const cursor = await getLocal<number>('sync:pushCursor', 0);
  const start = Date.now();
  const rows: { user_id: string; tbl: SyncTable; id: string; data: unknown; deleted: boolean }[] = [];

  for (const t of SYNC_TABLES) {
    const items = (await db.table(t).where('_ts').above(cursor).toArray()) as Record<string, unknown>[];
    for (const item of items) rows.push({ user_id: userId, tbl: t, id: String(item[PK[t]]), data: item, deleted: false });
  }
  const tombs = await db.tombstones.where('_ts').above(cursor).toArray();
  for (const t of tombs) rows.push({ user_id: userId, tbl: t.tbl, id: t.id, data: { _ts: t._ts }, deleted: true });

  for (let i = 0; i < rows.length; i += CHUNK) {
    const { error } = await supabase.from('records').upsert(rows.slice(i, i + CHUNK), { onConflict: 'user_id,tbl,id' });
    if (error) throw new Error(error.message);
  }
  await setLocal('sync:pushCursor', start - 1);
  return rows.length;
}

export async function applyRemote(records: RemoteRecord[]): Promise<void> {
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.tombstones], async (tx) => {
    (tx as unknown as { __remote: boolean }).__remote = true;
    for (const rec of records) {
      if (!SYNC_TABLES.includes(rec.tbl)) continue;
      const table = db.table(rec.tbl);
      const tombKey = `${rec.tbl}:${rec.id}`;
      const [local, tomb] = await Promise.all([table.get(rec.id) as Promise<{ _ts?: number } | undefined>, db.tombstones.get(tombKey)]);
      const localTs = Math.max(local?._ts ?? 0, tomb?._ts ?? 0);
      const remoteTs = Number(rec.data?._ts ?? 0);
      if (remoteTs < localTs) continue; // lokal neuer → wird beim Push hochgeladen
      if (rec.deleted) {
        if (local) await table.delete(rec.id);
      } else {
        await table.put(rec.data);
        if (tomb) await db.tombstones.delete(tombKey);
      }
    }
  });
}

async function pull(): Promise<number> {
  const cursor = await getLocal<string | null>('sync:pullCursor', null);
  const since = cursor ? new Date(new Date(cursor).getTime() - PULL_OVERLAP_MS).toISOString() : null;
  let offset = 0;
  let maxSeen = cursor;
  let total = 0;
  for (;;) {
    let q = supabase.from('records').select('tbl,id,data,deleted,updated_at').order('updated_at').order('tbl').order('id');
    if (since) q = q.gt('updated_at', since);
    const { data, error } = await q.range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as RemoteRecord[];
    if (page.length) {
      await applyRemote(page);
      const last = page[page.length - 1].updated_at;
      if (!maxSeen || last > maxSeen) maxSeen = last;
    }
    total += page.length;
    if (page.length < PAGE) break;
    offset += PAGE;
  }
  if (maxSeen) await setLocal('sync:pullCursor', maxSeen);
  return total;
}

async function syncOnce(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  if (!session) return setStatus({ state: 'off', email: undefined });
  if (!navigator.onLine) return setStatus({ state: 'offline', email: session.user.email });

  const owner = await getLocal<string | null>('sync:user', null);
  if (owner && owner !== session.user.id) {
    // Lokale Daten gehören zu einem anderen Account – nicht vermischen, erst nachfragen
    return setStatus({ state: 'conflict', email: session.user.email });
  }

  setStatus({ state: 'syncing', email: session.user.email, error: undefined });
  try {
    if (!(await getLocal<boolean>('sync:firstDone', false))) {
      // Vor dem allerersten Abgleich eine lokale Sicherung ablegen
      await setLocal('backup:pre-sync', await (await exportBackup()).text());
    }
    await setLocal('sync:user', session.user.id);
    await pull();
    await push(session.user.id);
    await setLocal('sync:firstDone', true);
    const now = Date.now();
    await setLocal('sync:last', now);
    setStatus({ state: 'idle', lastSync: now });
  } catch (e) {
    setStatus({ state: navigator.onLine ? 'error' : 'offline', error: (e as Error).message });
  }
}

let running: Promise<void> | null = null;
let again = false;

export function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    do {
      again = false;
      await syncOnce();
    } while (again);
  })().finally(() => {
    running = null;
  });
  return running;
}

let debounce: ReturnType<typeof setTimeout> | undefined;
function scheduleSync(delay = 3000) {
  if (status.state === 'off' || status.state === 'conflict') return;
  clearTimeout(debounce);
  debounce = setTimeout(() => void syncNow(), delay);
}

/** Löscht synchronisierte Daten auf diesem Gerät (ohne Tombstones), z. B. beim Wechsel auf einen anderen Account. */
export async function clearLocalSyncedData(): Promise<void> {
  await db.transaction('rw', [...SYNC_TABLES.map((t) => db.table(t)), db.tombstones, db.local], async (tx) => {
    (tx as unknown as { __remote: boolean }).__remote = true;
    for (const t of SYNC_TABLES) await db.table(t).clear();
    await db.tombstones.clear();
    for (const k of ['sync:pushCursor', 'sync:pullCursor', 'sync:firstDone', 'sync:user', 'sync:last']) await db.local.delete(k);
  });
}

/** Welcher Account hat zuletzt auf diesem Gerät synchronisiert? */
export function lastSyncUser(): Promise<string | null> {
  return getLocal<string | null>('sync:user', null);
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  setStatus({ state: 'off', email: undefined, lastSync: undefined });
}

/** Löscht alle Daten dieses Accounts in der Cloud. Lokale Daten bleiben. */
export async function deleteCloudData(): Promise<void> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return;
  const { error } = await supabase.from('records').delete().eq('user_id', data.session.user.id);
  if (error) throw new Error(error.message);
  for (const k of ['sync:pushCursor', 'sync:pullCursor', 'sync:firstDone']) await db.local.delete(k);
}

export async function initSync(): Promise<void> {
  setStatus({ lastSync: (await getLocal<number | undefined>('sync:last', undefined)) ?? undefined });
  onLocalChange(() => scheduleSync());
  supabase.auth.onAuthStateChange((event, session) => {
    if (!session) return setStatus({ state: 'off', email: undefined });
    setStatus({ email: session.user.email, state: status.state === 'off' ? 'idle' : status.state });
    // Keine Supabase-Aufrufe direkt im Callback (Deadlock-Gefahr), daher entkoppelt
    if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN') setTimeout(() => void syncNow(), 0);
  });
  window.addEventListener('online', () => scheduleSync(500));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && scheduleSync(500));
  setInterval(() => scheduleSync(0), 5 * 60 * 1000);
}
