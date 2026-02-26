import type jsPDF from 'jspdf'

function isInAppBrowser(): boolean {
  const ua = navigator.userAgent
  return /Line\//i.test(ua) || /FBAV/i.test(ua) || /Instagram/i.test(ua)
}

/**
 * 跨平台 PDF 儲存
 * - LINE/FB/IG in-app browser → 提示用外部瀏覽器開啟
 * - 其他瀏覽器（桌面 + 手機 Safari/Chrome）→ 標準下載
 */
export async function savePdfCompat(doc: jsPDF, fileName: string) {
  const name = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`

  if (isInAppBrowser()) {
    alert('此 App 內建瀏覽器不支援 PDF 下載\n\n請點擊右下角 ⋯ 選單\n→ 選擇「在預設瀏覽器中開啟」\n再重新下載 PDF')
    return
  }

  doc.save(name)
}
