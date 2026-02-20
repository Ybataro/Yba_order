// CJK Font loader for PDF export
// Fetches Noto Sans TC font at runtime and caches in memory

let cachedFont: string | null = null
let loading: Promise<string | null> | null = null

// Convert ArrayBuffer to base64 string
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

/**
 * Load Noto Sans TC font for jsPDF CJK support.
 * Tries /fonts/NotoSansTC-Regular.ttf first (local),
 * then falls back to Google Fonts CDN.
 * Returns base64-encoded font data, or null if unavailable.
 */
export async function loadNotoSansTC(): Promise<string | null> {
  if (cachedFont) return cachedFont

  // Prevent concurrent loads
  if (loading) return loading

  loading = (async () => {
    const sources = [
      '/fonts/NotoSansTC-Regular.ttf',
      'https://cdn.jsdelivr.net/gh/notofonts/noto-cjk/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf',
    ]

    for (const url of sources) {
      try {
        const res = await fetch(url)
        if (!res.ok) continue
        const buf = await res.arrayBuffer()
        if (buf.byteLength < 1000) continue // too small, probably 404 HTML
        cachedFont = arrayBufferToBase64(buf)
        return cachedFont
      } catch {
        continue
      }
    }

    console.warn('[exportPdf] CJK font not available. Place NotoSansTC-Regular.ttf in public/fonts/')
    return null
  })()

  const result = await loading
  loading = null
  return result
}
