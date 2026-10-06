import { openDB } from 'idb';

const DB_NAME = 'mikit-db';
const STORE_NAME = 'recordings';
const KARAOKE_STORE = 'karaokes';

export async function initDB() {
  return openDB(DB_NAME, 2, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
      if (!db.objectStoreNames.contains(KARAOKE_STORE)) {
        db.createObjectStore(KARAOKE_STORE, { keyPath: 'id', autoIncrement: true });
      }
    },
  });
}

export async function saveRecording(blob, metadata) {
  const db = await initDB();
  return db.add(STORE_NAME, {
    blob,
    ...metadata,
    createdAt: new Date().toISOString(),
  });
}

export async function getAllRecordings() {
  const db = await initDB();
  return db.getAll(STORE_NAME);
}

export async function deleteRecording(id) {
  const db = await initDB();
  return db.delete(STORE_NAME, id);
}

export async function updateRecording(recording) {
  const db = await initDB();
  return db.put(STORE_NAME, recording);
}

// Karaokes: audio + transcripción + fragmentos sincronizados
export async function saveKaraoke(blob, metadata) {
  const db = await initDB();
  return db.add(KARAOKE_STORE, {
    blob,
    ...metadata,
    createdAt: new Date().toISOString(),
  });
}

export async function getAllKaraokes() {
  const db = await initDB();
  return db.getAll(KARAOKE_STORE);
}

export async function deleteKaraoke(id) {
  const db = await initDB();
  return db.delete(KARAOKE_STORE, id);
}

export async function updateKaraoke(karaoke) {
  const db = await initDB();
  return db.put(KARAOKE_STORE, karaoke);
}

/**
 * Encuentra el índice del segmento de karaoke correspondiente a un tiempo en segundos.
 */
export function findSegmentIndex(segments, time) {
  if (!segments || segments.length === 0) return 0;
  const t = Math.max(0, Number(time) || 0);

  const firstStart = Number(segments[0].start) || 0;
  if (t <= firstStart) return 0;

  const lastStart = Number(segments[segments.length - 1].start) || 0;
  if (t >= lastStart) {
    return segments.length - 1;
  }

  for (let i = 0; i < segments.length; i++) {
    const curStart = Number(segments[i].start) || 0;
    const curEnd = Number(segments[i].end) || 0;
    const nextStart = segments[i + 1] ? (Number(segments[i + 1].start) || 0) : Infinity;

    if (t >= curStart && t <= curEnd) {
      return i;
    }

    if (t > curEnd && t < nextStart) {
      return i;
    }
  }

  return 0;
}

