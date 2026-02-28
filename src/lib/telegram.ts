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

export async function sendTelegramNotification(message: string, privateOnly = false, extraChatIds?: string[]): Promise<boolean> {
  try {
    const config = await loadConfig()
    if (!config) return false

    const chatIds = privateOnly ? [config.chatId] : [config.chatId, GROUP_CHAT_ID]
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
        }).then((r) => r.ok).catch(() => false)
      )
    )

    return results.some((ok) => ok)
  } catch (err) {
    console.warn('[Telegram] 通知發送失敗:', err)
    return false
  }
}
