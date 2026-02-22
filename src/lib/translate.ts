const TRANSLATE_URL = 'https://translate.googleapis.com/translate_a/single'

export async function translateText(
  text: string,
  targetLang: 'en' | 'ja',
): Promise<string> {
  if (!text.trim()) return ''

  const params = new URLSearchParams({
    client: 'gtx',
    sl: 'zh-TW',
    tl: targetLang,
    dt: 't',
    q: text,
  })

  const res = await fetch(`${TRANSLATE_URL}?${params}`)
  if (!res.ok) throw new Error(`Translate failed: ${res.status}`)

  const data = await res.json()
  // Response format: [[["translated text","source text",...],...],...]
  const sentences: string = (data[0] as [string][])
    .map((seg: [string]) => seg[0])
    .join('')

  return sentences
}
