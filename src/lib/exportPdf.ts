import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadNotoSansTC } from '@/assets/notoSansTC'
import { savePdfCompat } from '@/lib/savePdf'

export interface PdfColumn {
  header: string
  dataKey: string
}

export interface PdfExportOptions {
  title: string
  dateRange?: string
  columns: PdfColumn[]
  data: Record<string, unknown>[]
  fileName: string
}

async function registerFont(doc: jsPDF): Promise<boolean> {
  const fontData = await loadNotoSansTC()
  if (!fontData) return false

  try {
    doc.addFileToVFS('NotoSansTC-Regular.ttf', fontData)
    doc.addFont('NotoSansTC-Regular.ttf', 'NotoSansTC', 'normal')
    doc.setFont('NotoSansTC')
    return true
  } catch (e) {
    console.warn('[exportPdf] Font registration failed:', e)
    return false
  }
}

export async function exportToPdf({ title, dateRange, columns, data, fileName }: PdfExportOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const hasCJK = await registerFont(doc)

  const fontName = hasCJK ? 'NotoSansTC' : 'helvetica'

  // ── Brand header ──
  doc.setFontSize(16)
  doc.setFont(fontName, 'normal')
  doc.text('\u963F\u7238\u7684\u828B\u5713', 14, 15)  // 阿爸的芋圓

  doc.setFontSize(12)
  doc.text(title, 14, 23)

  if (dateRange) {
    doc.setFontSize(9)
    doc.setTextColor(120, 120, 120)
    doc.text(dateRange, 14, 29)
    doc.setTextColor(0, 0, 0)
  }

  const startY = dateRange ? 34 : 28

  // ── Table ──
  autoTable(doc, {
    startY,
    head: [columns.map((c) => c.header)],
    body: data.map((row) => columns.map((c) => String(row[c.dataKey] ?? ''))),
    styles: {
      font: fontName,
      fontSize: 8,
      cellPadding: 2,
    },
    headStyles: {
      fillColor: [139, 115, 85],  // brand-mocha approximate
      textColor: 255,
      fontStyle: 'normal',
      font: fontName,
    },
    alternateRowStyles: {
      fillColor: [248, 246, 243],  // light cream
    },
    margin: { left: 14, right: 14 },
    didDrawPage: (hookData) => {
      // Page number footer
      const pageCount = doc.getNumberOfPages()
      const pageNum = hookData.pageNumber
      doc.setFontSize(8)
      doc.setTextColor(160, 160, 160)
      doc.text(
        `${pageNum} / ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' },
      )
    },
  })

  await savePdfCompat(doc, fileName)
}
