// CJK Font loader for PDF export
// Fetches Noto Sans TC font at runtime and caches in memory

let cachedFont: string | null = null
let loading: Promise<string | null> | null = null

// Convert ArrayBuffer to base64 using FileReader (handles large files reliably)
function arrayBufferToBase64(buffer: ArrayBuffer): Promise<string> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([buffer])
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      // Remove "data:application/octet-stream;base64," prefix
      const base64 = dataUrl.split(',')[1]
      resolve(base64)
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

/**
 * Load Noto Sans TC font for jsPDF CJK support.
 * Tries /fonts/NotoSansTC-Regular.ttf (local, placed in public/fonts/).
 * Returns base64-encoded font data, or null if unavailable.
 */
export async function loadNotoSansTC(): Promise<string | null> {
  if (cachedFont) return cachedFont

  // Prevent concurrent loads
  if (loading) return loading

  loading = (async () => {
    try {
      const res = await fetch('/fonts/NotoSansTC-Regular.ttf')
      if (!res.ok) {
        console.warn('[exportPdf] Font not found at /fonts/NotoSansTC-Regular.ttf')
        return null
      }
      const buf = await res.arrayBuffer()
      if (buf.byteLength < 10000) {
        console.warn('[exportPdf] Font file too small, possibly not a real font')
        return null
      }
      cachedFont = await arrayBufferToBase64(buf)
      return cachedFont
    } catch (e) {
      console.warn('[exportPdf] Failed to load CJK font:', e)
      return null
    }
  })()

  const result = await loading
  loading = null
  return result
}
