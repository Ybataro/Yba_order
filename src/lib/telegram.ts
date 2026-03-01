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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string

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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Strip "data:image/jpeg;base64," prefix
      resolve(dataUrl.split(',')[1])
    }
    reader.onerror = () => reject(new Error('FileReader failed'))
    reader.readAsDataURL(blob)
  })
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

    // 壓縮照片
    const compressed = await Promise.all(photos.map((f) => compressPhoto(f)))

    // 轉 base64
    const base64Photos = await Promise.all(compressed.map((b) => blobToBase64(b)))

    const chatIds = privateOnly ? [config.chatId, ELLEN_CHAT_ID] : [config.chatId, ELLEN_CHAT_ID, GROUP_CHAT_ID]
    if (extraChatIds) chatIds.push(...extraChatIds)

    // POST to Supabase Edge Function
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-photo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        photos: base64Photos,
        caption,
        chat_ids: chatIds,
      }),
    })

    if (!r.ok) {
      const body = await r.text().catch(() => '')
      console.error('[Telegram Photo] Edge Function 錯誤:', r.status, body)
      return false
    }

    const data = await r.json()
    return data.ok === true
  } catch (err) {
    console.error('[Telegram Photo] 發送失敗:', err)
    return false
  }
}
