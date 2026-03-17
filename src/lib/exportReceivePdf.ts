import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadNotoSansTC } from '@/assets/notoSansTC'
import { savePdfCompat } from '@/lib/savePdf'
import { formatDualUnit } from '@/lib/utils'

interface ReceiveItem {
  name: string
  unit: string
  category: string
  orderQty: number
  actualQty: number
  hasDiff: boolean
  diff: number
  isExtra: boolean
  box_unit?: string
  box_ratio?: number
}

export interface ReceivePdfOptions {
  storeName: string
  date: string
  items: ReceiveItem[]
  extraItems: ReceiveItem[]
  categories: string[]
  note: string
  confirmedCount: number
  totalCount: number
  diffCount: number
}

const CATEGORY_COLORS: Record<string, [number, number, number]> = {
  '配料類（盒裝）': [247, 243, 237],
  '加工品類':       [249, 242, 229],
  '主食類（袋裝）': [235, 233, 231],
  '液體類':         [240, 239, 238],
  '冰品類':         [247, 242, 241],
  '其他':           [233, 231, 230],
  '叫貨備註':       [240, 245, 250],
}

const CATEGORY_HEADER_COLORS: Record<string, [number, number, number]> = {
  '配料類（盒裝）': [233, 222, 206],
  '加工品類':       [238, 220, 186],
  '主食類（袋裝）': [202, 197, 191],
  '液體類':         [216, 213, 211],
  '冰品類':         [233, 219, 217],
  '其他':           [196, 190, 187],
  '叫貨備註':       [200, 218, 235],
}

function setBold(doc: jsPDF, color: [number, number, number], strokeW = 0.35) {
  doc.setTextColor(...color)
  doc.setDrawColor(...color)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).internal.write(`2 Tr ${strokeW} w`)
}

function endBold(doc: jsPDF) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).internal.write('0 Tr 0 w')
  doc.setDrawColor(200, 195, 185)
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

function formatDateCN(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}（${WEEKDAYS[d.getDay()]}）`
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
    console.warn('[exportReceivePdf] Font registration failed:', e)
    return false
  }
}

export async function exportReceivePdf(opts: ReceivePdfOptions) {
  const { storeName, date, items, extraItems, categories, note, confirmedCount, totalCount, diffCount } = opts

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const hasCJK = await registerFont(doc)
  const fontName = hasCJK ? 'NotoSansTC' : 'helvetica'

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 10

  // ── Header ──
  doc.setFont(fontName, 'normal')
  doc.setFontSize(16)
  setBold(doc, [139, 115, 85], 0.5)
  doc.text('阿爸的芋圓', margin, 12)
  endBold(doc)

  doc.setFontSize(13)
  setBold(doc, [60, 46, 38], 0.4)
  doc.text(`${storeName} 收貨確認`, 55, 12)
  endBold(doc)

  doc.setFontSize(12)
  setBold(doc, [100, 90, 80], 0.3)
  doc.text(formatDateCN(date), pageW - margin, 12, { align: 'right' })
  endBold(doc)

  doc.setDrawColor(139, 115, 85)
  doc.setLineWidth(0.5)
  doc.line(margin, 15, pageW - margin, 15)

  // ── Summary line ──
  doc.setFontSize(9)
  doc.setFont(fontName, 'normal')
  doc.setTextColor(80, 70, 60)
  let summaryText = `確認 ${confirmedCount}/${totalCount} 項`
  if (diffCount > 0) summaryText += `　⚠ ${diffCount} 項數量異動`
  doc.text(summaryText, margin, 20)

  // ── Build table rows ──
  type RowType = 'category' | 'item' | 'extra-header'
  interface RowMeta { type: RowType; category: string; hasDiff?: boolean; catText?: string }
  const rowMeta: RowMeta[] = []
  const body: string[][] = []

  // Regular items by category
  for (const cat of categories) {
    const catItems = items.filter(i => !i.isExtra && i.category === cat)
    if (catItems.length === 0) continue

    rowMeta.push({ type: 'category', category: cat, catText: `■ ${cat}` })
    body.push(['', '', '', ''])  // empty — we draw category text manually

    for (const item of catItems) {
      const orderStr = formatDualUnit(item.orderQty, item.unit, item.box_unit, item.box_ratio)
      const actualStr = formatDualUnit(item.actualQty, item.unit, item.box_unit, item.box_ratio)
      const diffStr = item.hasDiff
        ? `${item.diff > 0 ? '+' : ''}${item.diff} ${item.unit}`
        : ''

      rowMeta.push({ type: 'item', category: cat, hasDiff: item.hasDiff })
      body.push([item.name, orderStr, actualStr, diffStr])
    }
  }

  // Note items
  const noteItems = items.filter(i => i.category === '叫貨備註')
  if (noteItems.length > 0) {
    rowMeta.push({ type: 'category', category: '叫貨備註', catText: '■ 叫貨備註' })
    body.push(['', '', '', ''])
    for (const item of noteItems) {
      const orderStr = formatDualUnit(item.orderQty, item.unit, item.box_unit, item.box_ratio)
      const actualStr = formatDualUnit(item.actualQty, item.unit, item.box_unit, item.box_ratio)
      const diffStr = item.hasDiff
        ? `${item.diff > 0 ? '+' : ''}${item.diff} ${item.unit}`
        : ''
      rowMeta.push({ type: 'item', category: '叫貨備註', hasDiff: item.hasDiff })
      body.push([item.name, orderStr, actualStr, diffStr])
    }
  }

  // Extra items
  if (extraItems.length > 0) {
    rowMeta.push({ type: 'extra-header', category: '', catText: '▶ 央廚主動出貨（未經叫貨）' })
    body.push(['', '', '', ''])

    for (const cat of categories) {
      const catExtras = extraItems.filter(i => i.category === cat)
      if (catExtras.length === 0) continue

      rowMeta.push({ type: 'category', category: cat, catText: `■ ${cat}` })
      body.push(['', '', '', ''])

      for (const item of catExtras) {
        const actualStr = formatDualUnit(item.actualQty, item.unit, item.box_unit, item.box_ratio)
        rowMeta.push({ type: 'item', category: cat })
        body.push([item.name, '-', actualStr, ''])
      }
    }
  }

  // ── Auto-sizing to fit 1 page (x1.3 larger) ──
  const totalRows = body.length
  const noteReserve = note ? 20 : 8
  const availableH = pageH - 22 - noteReserve
  const tableHeaderH = 7
  const targetRowH = (availableH - tableHeaderH) / totalRows
  const cellPad = Math.min(2.5, Math.max(0.8, targetRowH * 0.15))
  // Base font size, then ×1.3
  const baseFontSize = Math.min(10, Math.max(6.5, (targetRowH - cellPad * 2) / 0.42))
  const fontSize = baseFontSize * 1.3

  // ── Column widths ──
  const tableW = pageW - margin * 2
  const nameColW = Math.round(tableW * 0.40)
  const orderColW = Math.round(tableW * 0.20)
  const actualColW = Math.round(tableW * 0.20)
  const diffColW = tableW - nameColW - orderColW - actualColW

  let finalY = 22

  autoTable(doc, {
    startY: 22,
    head: [['品名', '叫貨量', '實收量', '差異']],
    body,
    styles: {
      font: fontName,
      fontSize,
      cellPadding: cellPad,
      valign: 'middle',
      lineWidth: 0.15,
      lineColor: [200, 195, 185],
      overflow: 'hidden',
    },
    headStyles: {
      fillColor: [90, 70, 50],
      textColor: 255,
      fontStyle: 'normal',
      font: fontName,
      fontSize: fontSize + 0.5,
      cellPadding: Math.max(cellPad, 1.5),
      halign: 'center',
    },
    columnStyles: {
      0: { cellWidth: nameColW, halign: 'left' },
      1: { cellWidth: orderColW, halign: 'center' },
      2: { cellWidth: actualColW, halign: 'center' },
      3: { cellWidth: diffColW, halign: 'center' },
    },
    margin: { left: margin, right: margin },
    didParseCell: (hookData) => {
      const rowIdx = hookData.row.index
      if (hookData.section !== 'body' || rowIdx >= rowMeta.length) return
      const meta = rowMeta[rowIdx]

      if (meta.type === 'category') {
        const cat = meta.category
        hookData.cell.styles.fillColor = CATEGORY_HEADER_COLORS[cat] || [220, 215, 210]
        // Hide autoTable default text — we draw bold text in didDrawCell
        hookData.cell.styles.textColor = CATEGORY_HEADER_COLORS[cat] || [220, 215, 210]
        hookData.cell.styles.fontSize = fontSize + 0.5
      } else if (meta.type === 'extra-header') {
        hookData.cell.styles.fillColor = [235, 230, 225]
        // Hide autoTable default text
        hookData.cell.styles.textColor = [235, 230, 225]
        hookData.cell.styles.fontSize = fontSize + 0.5
      } else if (meta.type === 'item') {
        const cat = meta.category
        hookData.cell.styles.fillColor = CATEGORY_COLORS[cat] || [255, 255, 255]

        // 叫貨量 & 實收量 columns: bold black
        const colIdx = hookData.column.index
        if (colIdx === 1 || colIdx === 2) {
          hookData.cell.styles.textColor = [30, 25, 20]
        }

        // Diff column highlight
        if (meta.hasDiff && colIdx === 3) {
          hookData.cell.styles.textColor = [180, 100, 30]
        }
      }
    },
    didDrawCell: (hookData) => {
      const rowIdx = hookData.row.index
      if (hookData.section !== 'body' || rowIdx >= rowMeta.length) return
      const meta = rowMeta[rowIdx]

      // Draw bold category/extra-header text manually (only in col 0)
      if ((meta.type === 'category' || meta.type === 'extra-header') && hookData.column.index === 0) {
        const { x, y, height } = hookData.cell
        const text = meta.catText || ''
        doc.setFont(fontName, 'normal')
        doc.setFontSize(fontSize + 0.5)
        const color: [number, number, number] = meta.type === 'extra-header' ? [100, 80, 60] : [60, 46, 38]
        setBold(doc, color, 0.3)
        doc.text(text, x + 2, y + height / 2 + 0.5, { baseline: 'middle' })
        endBold(doc)
      }

      // Draw bold numbers for 叫貨量 & 實收量 columns
      if (meta.type === 'item') {
        const colIdx = hookData.column.index
        if (colIdx === 1 || colIdx === 2) {
          const { x, y, width, height } = hookData.cell
          const text = hookData.cell.text[0] || ''
          if (!text || text === '-') return
          // Draw filled background first to cover autoTable's normal text
          const bg = meta.category
            ? (CATEGORY_COLORS[meta.category] || [255, 255, 255])
            : [255, 255, 255] as [number, number, number]
          doc.setFillColor(...bg)
          doc.rect(x + 0.2, y + 0.2, width - 0.4, height - 0.4, 'F')
          // Draw bold text
          doc.setFont(fontName, 'normal')
          doc.setFontSize(fontSize)
          setBold(doc, [30, 25, 20], 0.25)
          doc.text(text, x + width / 2, y + height / 2 + 0.5, { align: 'center', baseline: 'middle' })
          endBold(doc)
        }
      }
    },
    didDrawPage: (hookData) => {
      finalY = hookData.cursor?.y ?? finalY
    },
  })

  // ── Note ──
  if (note) {
    const noteY = Math.min(finalY + 4, pageH - 16)
    doc.setFontSize(8)
    doc.setFont(fontName, 'normal')
    doc.setTextColor(120, 110, 100)
    doc.text('差異備註：', margin, noteY)
    doc.setTextColor(60, 50, 40)
    doc.text(note, margin + 18, noteY)
  }

  // ── Footer ──
  doc.setFontSize(7)
  doc.setTextColor(160, 155, 150)
  doc.text(`列印時間：${new Date().toLocaleString('zh-TW', { timeZone: 'Asia/Taipei' })}`, margin, pageH - 5)
  doc.text('阿爸的芋圓 收貨確認', pageW - margin, pageH - 5, { align: 'right' })

  const fileName = `收貨確認_${storeName}_${date}`
  await savePdfCompat(doc, fileName)
}
