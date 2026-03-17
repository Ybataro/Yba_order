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
