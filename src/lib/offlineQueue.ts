import { openDB, type IDBPDatabase } from 'idb'

const DB_NAME = 'yba_offline'
const DB_VERSION = 2 // V2.0：加 status 欄位
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
  status?: 'pending' | 'failed'    // V2.0：失敗標記
  failReason?: string               // V2.0：失敗原因
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
  await db.put(STORE_NAME, { ...submission, status: submission.status || 'pending' })
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

// ═══ V2.0：去重 + 序列化同步 + 失敗標記 ═══

/** 標記單筆為失敗 */
export async function markAsFailed(id: string, reason: string): Promise<void> {
  const db = await getDB()
  const item = await db.get(STORE_NAME, id) as PendingSubmission | undefined
  if (item) {
    item.status = 'failed'
    item.failReason = reason
    await db.put(STORE_NAME, item)
  }
}

/** 取得失敗筆數 */
export async function getFailedCount(): Promise<number> {
  const all = await getPendingSubmissions()
  return all.filter(p => p.status === 'failed').length
}

/**
 * 去重：同一 sessionId 只保留最新一筆（丟棄舊的 pending 狀態）
 * 已標記 failed 的不參與去重（保留給手動處理）
 */
export async function deduplicateQueue(): Promise<PendingSubmission[]> {
  const all = await getPendingSubmissions()
  const pendingItems = all.filter(p => p.status !== 'failed')
  const failedItems = all.filter(p => p.status === 'failed')

  // 同 sessionId 只留最新
  const map = new Map<string, PendingSubmission>()
  for (const item of pendingItems) {
    const existing = map.get(item.sessionId)
    if (!existing || item.createdAt > existing.createdAt) {
      map.set(item.sessionId, item)
    }
  }

  // 清除被丟棄的舊筆
  const keptIds = new Set([...map.values()].map(v => v.id))
  for (const item of pendingItems) {
    if (!keptIds.has(item.id)) {
      await removePendingSubmission(item.id)
    }
  }

  return [...map.values(), ...failedItems]
}
