import { supabase } from '@/lib/supabase'

let configPromise: Promise<{ token: string; chatId: string } | null> | null = null

function loadConfig(): Promise<{ token: string; chatId: string } | null> {
  if (configPromise) return configPromise

  configPromise = (async () => {
    if (!supabase) return null

    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .in('key', ['telegram_bot_token', 'telegram_chat_id'])

    if (!data || data.length < 2) return null

    let token: string | null = null
    let chatId: string | null = null
    for (const row of data) {
      if (row.key === 'telegram_bot_token') token = row.value
      if (row.key === 'telegram_chat_id') chatId = row.value
    }

    if (!token || !chatId) return null
    return { token, chatId }
  })()

  return configPromise
}

const GROUP_CHAT_ID = '-4715692611'
const ELLEN_CHAT_ID = '8515675347'  // 老闆娘
const YEN_CHAT_ID = '7920645981'    // 管理者

// Legacy: 各店請假通知對象（保留給非請假用途）
export const LEAVE_NOTIFY_MAP: Record<string, string[]> = {
  lehua:  [YEN_CHAT_ID, ELLEN_CHAT_ID, '7250361245'],
  xingnan:[YEN_CHAT_ID, ELLEN_CHAT_ID, '7855426610'],
  kitchen:[YEN_CHAT_ID, ELLEN_CHAT_ID],
}

// ── 動態請假通知對象（從 app_settings 讀取）──
export interface NotifyTarget {
  name: string
  chat_id: string
}

let notifyCache: Record<string, NotifyTarget[]> | null = null

export async function getLeaveNotifyTargets(storeContext: string): Promise<string[]> {
  if (!supabase) return []
  if (!notifyCache) {
    const { data } = await supabase
      .from('app_settings')
      .select('key, value')
      .like('key', 'leave_notify_%')
    notifyCache = {}
    if (data) {
      for (const row of data) {
        const scope = row.key.replace('leave_notify_', '')
        try {
          notifyCache[scope] = JSON.parse(row.value) as NotifyTarget[]
        } catch {
          notifyCache[scope] = []
        }
      }
    }
  }
  const targets = notifyCache[storeContext] || []
  return targets.map((t) => t.chat_id)
}

export async function getAdminNotifyTargets(): Promise<string[]> {
  return getLeaveNotifyTargets('admin')
}

/** 清除快取（後台更新設定後呼叫） */
export function clearLeaveNotifyCache(): void {
  notifyCache = null
}

const MAX_PHOTO_SIZE = 1600
const JPEG_QUALITY = 0.7

function compressPhoto(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      URL.revokeObjectURL(img.src)
      reject(new Error('compressPhoto timeout'))
    }, 10000)

    const img = new Image()
    img.onload = () => {
      clearTimeout(timer)
      let { width, height } = img
      if (width > MAX_PHOTO_SIZE || height > MAX_PHOTO_SIZE) {
        const ratio = Math.min(MAX_PHOTO_SIZE / width, MAX_PHOTO_SIZE / height)
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob)
          else reject(new Error('Canvas toBlob failed'))
        },
        'image/jpeg',
        JPEG_QUALITY
      )
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => { clearTimeout(timer); URL.revokeObjectURL(img.src); reject(new Error('Image load failed')) }
    img.src = URL.createObjectURL(file)
  })
}

async function sendPhotosDirect(
  token: string,
  blobs: Blob[],
  caption: string,
  chatIds: string[]
): Promise<boolean> {
  const baseUrl = `https://api.telegram.org/bot${token}`
  let anyOk = false

  for (const chatId of chatIds) {
    try {
      if (blobs.length === 1) {
        const form = new FormData()
        form.append('chat_id', chatId)
        form.append('photo', new File([blobs[0]], 'photo.jpg', { type: 'image/jpeg' }))
        form.append('caption', caption)
        form.append('parse_mode', 'HTML')
        const r = await fetch(`${baseUrl}/sendPhoto`, { method: 'POST', body: form })
        if (r.ok) { anyOk = true }
        else { const t = await r.text().catch(() => ''); console.warn(`[Telegram Photo] chat_id=${chatId} ${r.status}:`, t) }
      } else {
        const form = new FormData()
        form.append('chat_id', chatId)
        const media = blobs.map((_, i) => ({
          type: 'photo',
          media: `attach://photo${i}`,
          ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}),
        }))
        form.append('media', JSON.stringify(media))
        blobs.forEach((blob, i) => {
          form.append(`photo${i}`, new File([blob], `photo${i}.jpg`, { type: 'image/jpeg' }), `photo${i}.jpg`)
        })
        const r = await fetch(`${baseUrl}/sendMediaGroup`, { method: 'POST', body: form })
        if (r.ok) { anyOk = true }
        else { const t = await r.text().catch(() => ''); console.warn(`[Telegram Photo] chat_id=${chatId} ${r.status}:`, t) }
      }
    } catch (err) {
      console.error(`[Telegram Photo] chat_id=${chatId} 失敗:`, err)
    }
  }

  return anyOk
}

export async function sendTelegramToTargets(message: string, chatIds: string[]): Promise<boolean> {
  try {
    const config = await loadConfig()
    if (!config || chatIds.length === 0) return false
    const results = await Promise.all(
      chatIds.map((chatId) =>
        fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
        }).then((r) => {
          if (!r.ok) console.warn(`[Telegram] chat_id=${chatId} 回應:`, r.status)
          return r.ok
        }).catch((err) => { console.error(`[Telegram] chat_id=${chatId} 失敗:`, err); return false })
      )
    )
    return results.some((ok) => ok)
  } catch (err) {
    console.warn('[Telegram] 通知發送失敗:', err)
    return false
  }
}

export async function sendTelegramPhotosToTargets(photos: File[], caption: string, chatIds: string[]): Promise<boolean> {
  try {
    const config = await loadConfig()
    if (!config || chatIds.length === 0) { console.warn('[Telegram Photo] config 載入失敗, chatIds:', chatIds.length); return false }
    if (photos.length === 0) return true
    console.log(`[Telegram Photo] 壓縮 ${photos.length} 張照片...`)
    const compressed = await Promise.all(photos.map((f) => compressPhoto(f)))
    console.log(`[Telegram Photo] 壓縮完成, sizes:`, compressed.map((b) => b.size))
    return sendPhotosDirect(config.token, compressed, caption, chatIds)
  } catch (err) {
    console.error('[Telegram Photo] 發送失敗:', err)
    return false
  }
}

export async function sendTelegramNotification(message: string, privateOnly = false, extraChatIds?: string[]): Promise<boolean> {
  try {
    const config = await loadConfig()
    if (!config) return false

    const chatIds = privateOnly ? [config.chatId, ELLEN_CHAT_ID] : [config.chatId, ELLEN_CHAT_ID, GROUP_CHAT_ID]
    if (extraChatIds) chatIds.push(...extraChatIds)
    const results = await Promise.all(
      chatIds.map((chatId) =>
        fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
          }),
        }).then((r) => {
          if (!r.ok) console.warn(`[Telegram] chat_id=${chatId} 回應:`, r.status)
          return r.ok
        }).catch((err) => { console.error(`[Telegram] chat_id=${chatId} 失敗:`, err); return false })
      )
    )

    return results.some((ok) => ok)
  } catch (err) {
    console.warn('[Telegram] 通知發送失敗:', err)
    return false
  }
}

export async function sendTelegramPhotos(
  photos: File[],
  caption: string,
  privateOnly = false,
  extraChatIds?: string[]
): Promise<boolean> {
  try {
    const config = await loadConfig()
    if (!config) { console.warn('[Telegram Photo] config 載入失敗'); return false }
    if (photos.length === 0) return true

    const compressed = await Promise.all(photos.map((f) => compressPhoto(f)))

    const chatIds = privateOnly ? [config.chatId, ELLEN_CHAT_ID] : [config.chatId, ELLEN_CHAT_ID, GROUP_CHAT_ID]
    if (extraChatIds) chatIds.push(...extraChatIds)

    return sendPhotosDirect(config.token, compressed, caption, chatIds)
  } catch (err) {
    console.error('[Telegram Photo] 發送失敗:', err)
    return false
  }
}

// ══════════════════════════════════════════════════════════
// V2 請假系統專用函式
// ══════════════════════════════════════════════════════════

/** V2 快取：主管清單（從 user_pins + staff 查詢，取代 app_settings）*/
let approverCache: Record<string, string[]> | null = null

/** 清除 V2 主管快取（PinManager 儲存後呼叫）*/
export function clearLeaveApproverCache(): void {
  approverCache = null
}

/**
 * V2：依 scope + order 查詢請假主管的 Telegram chat_id
 * 從 user_pins 的 is_leave_approver / leave_approver_scope / leave_approver_order
 * join staff.telegram_id 取得 chat_id
 *
 * @param scope  群組：'kitchen' | 'lehua' | 'xingnan'
 * @param order  簽核順序：1 = 第一主管, 2 = 第二主管, undefined = 全部
 */
export async function getLeaveApproverChatIds(
  scope: string,
  order?: 1 | 2
): Promise<string[]> {
  if (!supabase) return []

  const cacheKey = `${scope}_${order ?? 'all'}`
  if (approverCache?.[cacheKey]) return approverCache[cacheKey]

  // 查 user_pins 找到符合 scope 的主管
  let query = supabase
    .from('user_pins')
    .select('staff_id, leave_approver_order')
    .eq('is_leave_approver', true)
    .eq('leave_approver_scope', scope)
    .eq('is_active', true)

  if (order !== undefined) {
    query = query.eq('leave_approver_order', order)
  }

  const { data: pinData, error: pinErr } = await query
  if (pinErr || !pinData || pinData.length === 0) return []

  const staffIds = pinData.map((p) => p.staff_id as string)

  // 從 staff 取 telegram_id
  const { data: staffData, error: staffErr } = await supabase
    .from('staff')
    .select('id, telegram_id')
    .in('id', staffIds)

  if (staffErr || !staffData) return []

  const chatIds = staffData
    .map((s) => s.telegram_id as string | null)
    .filter((id): id is string => !!id && id.trim() !== '')

  if (!approverCache) approverCache = {}
  approverCache[cacheKey] = chatIds

  return chatIds
}

/**
 * V2：查詢某 scope 是否已設定完整的雙主管（order 1 + order 2 各一人）
 * 用於送假前的前置驗證：若未設滿，阻擋送假並提示
 */
export async function checkLeaveApproversReady(scope: string): Promise<{
  ready: boolean
  approver1Count: number
  approver2Count: number
}> {
  if (!supabase) return { ready: false, approver1Count: 0, approver2Count: 0 }

  const { data, error } = await supabase
    .from('user_pins')
    .select('leave_approver_order')
    .eq('is_leave_approver', true)
    .eq('leave_approver_scope', scope)
    .eq('is_active', true)

  if (error || !data) return { ready: false, approver1Count: 0, approver2Count: 0 }

  const approver1Count = data.filter((p) => p.leave_approver_order === 1).length
  const approver2Count = data.filter((p) => p.leave_approver_order === 2).length

  return {
    ready: approver1Count >= 1 && approver2Count >= 1,
    approver1Count,
    approver2Count,
  }
}

/**
 * V2：通知 admin 最終審核者（從 user_pins 查 role=admin 且有 telegram_id 的員工）
 * 取代舊的 getAdminNotifyTargets()（仍保留舊版供向後相容）
 */
export async function getAdminApproverChatIds(): Promise<string[]> {
  if (!supabase) return []

  const { data: pinData, error: pinErr } = await supabase
    .from('user_pins')
    .select('staff_id')
    .eq('role', 'admin')
    .eq('is_active', true)

  if (pinErr || !pinData || pinData.length === 0) return []

  const staffIds = pinData.map((p) => p.staff_id as string)

  const { data: staffData, error: staffErr } = await supabase
    .from('staff')
    .select('telegram_id')
    .in('id', staffIds)

  if (staffErr || !staffData) return []

  return staffData
    .map((s) => s.telegram_id as string | null)
    .filter((id): id is string => !!id && id.trim() !== '')
}

/**
 * V2：通知員工本人請假結果（核准或駁回）
 * @param staffId  員工 staff_id
 * @param message  HTML 格式訊息
 */
export async function notifyStaffLeaveResult(staffId: string, message: string): Promise<void> {
  if (!supabase) return

  const { data, error } = await supabase
    .from('staff')
    .select('telegram_id')
    .eq('id', staffId)
    .single()

  if (error || !data?.telegram_id) return

  sendTelegramToTargets(message, [data.telegram_id])
    .then((ok) => { if (!ok) console.warn(`[V2 員工通知] staff_id=${staffId} 發送失敗`) })
    .catch((err) => console.error(`[V2 員工通知] staff_id=${staffId} 錯誤:`, err))
}
