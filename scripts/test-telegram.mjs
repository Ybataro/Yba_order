import { createClient } from '@supabase/supabase-js'

const sb = createClient(
  'https://qshfgheqsnsghwqaqehi.supabase.co',
  'sb_publishable_xTxUuXl9Jpmo85bkKwLSSg_Y8fIiCGN'
)

const { data } = await sb
  .from('app_settings')
  .select('key, value')
  .eq('key', 'telegram_bot_token')
  .single()

if (!data) {
  console.log('No token found')
  process.exit(1)
}

const token = data.value

// Check bot info and chat member status
console.log('--- Bot Info ---')
const meRes = await fetch(`https://api.telegram.org/bot${token}/getMe`)
const me = await meRes.json()
console.log(JSON.stringify(me, null, 2))

console.log('\n--- getChat for 8515675347 ---')
const chatRes = await fetch(`https://api.telegram.org/bot${token}/getChat`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: '8515675347' })
})
console.log('HTTP Status:', chatRes.status)
const chatJson = await chatRes.json()
console.log(JSON.stringify(chatJson, null, 2))

console.log('\n--- sendMessage to 8515675347 ---')
const sendRes = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ chat_id: '8515675347', text: '測試通知 from script' })
})
console.log('HTTP Status:', sendRes.status)
const sendJson = await sendRes.json()
console.log(JSON.stringify(sendJson, null, 2))
