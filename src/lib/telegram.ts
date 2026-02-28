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
    console.log('[Telegram Photo] 開始處理', photos.length, '張照片')
    const config = await loadConfig()
    if (!config) { console.warn('[Telegram Photo] config 載入失敗'); return false }
    if (photos.length === 0) return true

    // 壓縮照片（手機原圖太大會觸發 HTTP/2 錯誤）
    console.log('[Telegram Photo] 開始壓縮...')
    const compressed = await Promise.all(photos.map((f) => compressPhoto(f)))
    console.log('[Telegram Photo] 壓縮完成，大小:', compressed.map(b => `${(b.size / 1024).toFixed(0)}KB`))

    const baseUrl = `https://api.telegram.org/bot${config.token}`
    const targetIds = privateOnly ? [config.chatId, ELLEN_CHAT_ID] : [config.chatId, ELLEN_CHAT_ID, GROUP_CHAT_ID]
    if (extraChatIds) targetIds.push(...extraChatIds)

    // 逐一發送（避免同時多個 fetch 上傳造成 HTTP/2 連線問題）
    let anyOk = false
    for (const chatId of targetIds) {
      try {
        const sendOne = async (blobs: Blob[]): Promise<boolean> => {
          if (blobs.length === 1) {
            const form = new FormData()
            form.append('chat_id', chatId)
            form.append('photo', blobs[0], 'photo.jpg')
            form.append('caption', caption)
            form.append('parse_mode', 'HTML')

            console.log(`[Telegram Photo] sendPhoto chat_id=${chatId} 發送中...`)
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 12000)
            const r = await fetch(`${baseUrl}/sendPhoto`, {
              method: 'POST',
              body: form,
              signal: controller.signal,
            })
            clearTimeout(timer)
            if (!r.ok) {
              const body = await r.text().catch(() => '')
              console.warn(`[Telegram Photo] sendPhoto chat_id=${chatId} status=${r.status}`, body)
            } else {
              console.log(`[Telegram Photo] sendPhoto chat_id=${chatId} 成功`)
            }
            return r.ok
          } else {
            const form = new FormData()
            form.append('chat_id', chatId)

            const media = blobs.map((_, i) => ({
              type: 'photo' as const,
              media: `attach://photo${i}`,
              ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}),
            }))
            form.append('media', JSON.stringify(media))
            blobs.forEach((blob, i) => {
              form.append(`photo${i}`, blob, `photo${i}.jpg`)
            })

            console.log(`[Telegram Photo] sendMediaGroup chat_id=${chatId} 發送中...`)
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), 12000)
            const r = await fetch(`${baseUrl}/sendMediaGroup`, {
              method: 'POST',
              body: form,
              signal: controller.signal,
            })
            clearTimeout(timer)
            if (!r.ok) {
              const body = await r.text().catch(() => '')
              console.warn(`[Telegram Photo] sendMediaGroup chat_id=${chatId} status=${r.status}`, body)
            } else {
              console.log(`[Telegram Photo] sendMediaGroup chat_id=${chatId} 成功`)
            }
            return r.ok
          }
        }
        const ok = await sendOne(compressed)
        if (ok) anyOk = true
      } catch (err) {
        console.error(`[Telegram Photo] chat_id=${chatId} 失敗:`, err)
      }
    }

    return anyOk
  } catch (err) {
    console.warn('[Telegram Photo] 發送失敗:', err)
    return false
  }
}
