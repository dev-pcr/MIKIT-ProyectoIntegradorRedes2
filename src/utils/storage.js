import { openDB } from 'idb';

const DB_NAME = 'mikit-db';
const STORE_NAME = 'recordings';

export async function initDB() {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
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
