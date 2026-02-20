import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'yba_offline'
const DB_VERSION = 1
const STORE_NAME = 'pending_submissions'

export interface PendingSubmission {
  id: string
  type: 'inventory' | 'order' | 'settlement'
  storeId: string
  sessionId: string
  payload: {
    session: Record<string, unknown>
    items: Record<string, unknown>[]
  }
  createdAt: number
}

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

export async function addPendingSubmission(submission: PendingSubmission): Promise<void> {
  const db = await getDB()
  await db.put(STORE_NAME, submission)
}

export async function getPendingSubmissions(): Promise<PendingSubmission[]> {
  const db = await getDB()
  return db.getAll(STORE_NAME)
}

export async function removePendingSubmission(id: string): Promise<void> {
  const db = await getDB()
  await db.delete(STORE_NAME, id)
}

export async function getPendingCount(): Promise<number> {
  const db = await getDB()
  return db.count(STORE_NAME)
}

export async function clearAllPending(): Promise<void> {
  const db = await getDB()
  await db.clear(STORE_NAME)
}
