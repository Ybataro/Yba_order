import { supabase } from '@/lib/supabase'

let cachedToken: string | null = null
let cachedChatId: string | null = null
let cacheLoaded = false

async function loadConfig(): Promise<{ token: string; chatId: string } | null> {
  if (cacheLoaded) {
    if (cachedToken && cachedChatId) return { token: cachedToken, chatId: cachedChatId }
    return null
  }

  cacheLoaded = true

  if (!supabase) return null

  const { data } = await supabase
    .from('app_settings')
    .select('key, value')
    .in('key', ['telegram_bot_token', 'telegram_chat_id'])

  if (!data || data.length < 2) return null

  for (const row of data) {
    if (row.key === 'telegram_bot_token') cachedToken = row.value
    if (row.key === 'telegram_chat_id') cachedChatId = row.value
  }

  if (!cachedToken || !cachedChatId) return null
  return { token: cachedToken, chatId: cachedChatId }
}

const GROUP_CHAT_ID = '-4715692611'
const ELLEN_CHAT_ID = '8515675347'  // 老闆娘

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
    if (!config) return false
    if (photos.length === 0) return true

    const baseUrl = `https://api.telegram.org/bot${config.token}`
    const targetIds = privateOnly ? [config.chatId, ELLEN_CHAT_ID] : [config.chatId, ELLEN_CHAT_ID, GROUP_CHAT_ID]
    if (extraChatIds) targetIds.push(...extraChatIds)

    const results = await Promise.all(
      targetIds.map(async (chatId) => {
        try {
          if (photos.length === 1) {
            const form = new FormData()
            form.append('chat_id', chatId)
            form.append('photo', photos[0])
            form.append('caption', caption)
            form.append('parse_mode', 'HTML')

            const r = await fetch(`${baseUrl}/sendPhoto`, { method: 'POST', body: form })
            if (!r.ok) console.warn(`[Telegram Photo] chat_id=${chatId} 回應:`, r.status)
            return r.ok
          } else {
            const form = new FormData()
            form.append('chat_id', chatId)

            const media = photos.map((_, i) => ({
              type: 'photo' as const,
              media: `attach://photo${i}`,
              ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}),
            }))
            form.append('media', JSON.stringify(media))

            photos.forEach((photo, i) => {
              form.append(`photo${i}`, photo)
            })

            const r = await fetch(`${baseUrl}/sendMediaGroup`, { method: 'POST', body: form })
            if (!r.ok) console.warn(`[Telegram Photo] chat_id=${chatId} 回應:`, r.status)
            return r.ok
          }
        } catch (err) {
          console.error(`[Telegram Photo] chat_id=${chatId} 失敗:`, err)
          return false
        }
      })
    )

    return results.some((ok) => ok)
  } catch (err) {
    console.warn('[Telegram Photo] 發送失敗:', err)
    return false
  }
}
