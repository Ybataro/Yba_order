import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface RequestBody {
  photos: string[]   // base64 encoded JPEG
  caption: string
  chat_ids: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const token = Deno.env.get('TELEGRAM_BOT_TOKEN')
    if (!token) {
      return new Response(
        JSON.stringify({ ok: false, error: 'TELEGRAM_BOT_TOKEN not set' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { photos, caption, chat_ids } = await req.json() as RequestBody

    if (!photos || !Array.isArray(photos) || photos.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No photos provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!chat_ids || !Array.isArray(chat_ids) || chat_ids.length === 0) {
      return new Response(
        JSON.stringify({ ok: false, error: 'No chat_ids provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const baseUrl = `https://api.telegram.org/bot${token}`

    // Convert base64 strings to Blobs
    const blobs = photos.map((b64) => {
      const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))
      return new Blob([bytes], { type: 'image/jpeg' })
    })

    const results: { chat_id: string; ok: boolean; error?: string }[] = []

    for (const chatId of chat_ids) {
      try {
        if (blobs.length === 1) {
          // Single photo: sendPhoto
          const form = new FormData()
          form.append('chat_id', chatId)
          form.append('photo', blobs[0], 'photo.jpg')
          form.append('caption', caption)
          form.append('parse_mode', 'HTML')

          const r = await fetch(`${baseUrl}/sendPhoto`, { method: 'POST', body: form })
          if (!r.ok) {
            const body = await r.text().catch(() => '')
            results.push({ chat_id: chatId, ok: false, error: `${r.status} ${body}` })
          } else {
            results.push({ chat_id: chatId, ok: true })
          }
        } else {
          // Multiple photos: sendMediaGroup
          const form = new FormData()
          form.append('chat_id', chatId)

          const media = blobs.map((_, i) => ({
            type: 'photo',
            media: `attach://photo${i}`,
            ...(i === 0 ? { caption, parse_mode: 'HTML' } : {}),
          }))
          form.append('media', JSON.stringify(media))
          blobs.forEach((blob, i) => {
            form.append(`photo${i}`, blob, `photo${i}.jpg`)
          })

          const r = await fetch(`${baseUrl}/sendMediaGroup`, { method: 'POST', body: form })
          if (!r.ok) {
            const body = await r.text().catch(() => '')
            results.push({ chat_id: chatId, ok: false, error: `${r.status} ${body}` })
          } else {
            results.push({ chat_id: chatId, ok: true })
          }
        }
      } catch (err) {
        results.push({ chat_id: chatId, ok: false, error: String(err) })
      }
    }

    const anyOk = results.some((r) => r.ok)
    return new Response(
      JSON.stringify({ ok: anyOk, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
