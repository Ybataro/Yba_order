import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadNotoSansTC } from '@/assets/notoSansTC'
import { savePdfCompat } from '@/lib/savePdf'
import type { StoreProduct } from '@/data/storeProducts'

// ── Category colors (品牌色系淺色調 — 對應 UI brand palette) ──
// camel(201,172,132) amber(212,168,83) mocha(122,110,95) lotus(158,149,144) blush(201,165,160) oak(107,93,85)
const CATEGORY_COLORS: Record<string, [number, number, number]> = {
  '配料類（盒裝）': [247, 243, 237],  // camel 淺色
  '加工品類':       [249, 242, 229],  // amber 淺色
  '主食類（袋裝）': [235, 233, 231],  // mocha 淺色
  '液體類':         [240, 239, 238],  // lotus 淺色
  '冰品類':         [247, 242, 241],  // blush 淺色
  '其他':           [233, 231, 230],  // oak 淺色
}

const CATEGORY_HEADER_COLORS: Record<string, [number, number, number]> = {
  '配料類（盒裝）': [233, 222, 206],  // camel 中色
  '加工品類':       [238, 220, 186],  // amber 中色
  '主食類（袋裝）': [202, 197, 191],  // mocha 中色
  '液體類':         [216, 213, 211],  // lotus 中色
  '冰品類':         [233, 219, 217],  // blush 中色
  '其他':           [196, 190, 187],  // oak 中色
}

function getCategoryColor(cat: string): [number, number, number] {
  return CATEGORY_COLORS[cat] || [255, 255, 255]
}

function getCategoryHeaderColor(cat: string): [number, number, number] {
  return CATEGORY_HEADER_COLORS[cat] || [220, 215, 210]
}

// ── Bold text: 用 fill+stroke 渲染模式模擬粗體 ──
function setBold(doc: jsPDF, color: [number, number, number], strokeW = 0.35) {
  doc.setTextColor(...color)
  doc.setDrawColor(...color)
  // PDF rendering mode 2 = fill+stroke → 模擬粗體
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).internal.write(`2 Tr ${strokeW} w`)
}

function endBold(doc: jsPDF) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).internal.write('0 Tr 0 w')
  doc.setDrawColor(200, 195, 185) // restore border color
}

export interface OrderSummaryPdfOptions {
  date: string
  stores: { id: string; name: string }[]
  products: StoreProduct[]
  categories: string[]
  storeOrders: Record<string, Record<string, number>>
  storeNotes: Record<string, { fixedItems: Record<string, number>; freeText: string }>
  fixedNoteItems: { id: string; label: string; unit: string }[]
  productStock: Record<string, number>
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
    console.warn('[exportOrderSummaryPdf] Font registration failed:', e)
    return false
  }
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']
function formatDateCN(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}（${WEEKDAYS[d.getDay()]}）`
}

export async function exportOrderSummaryToPdf(opts: OrderSummaryPdfOptions) {
  const { date, stores, products, categories, storeOrders, storeNotes, fixedNoteItems, productStock } = opts

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const hasCJK = await registerFont(doc)
  const fontName = hasCJK ? 'NotoSansTC' : 'helvetica'

  const pageW = doc.internal.pageSize.getWidth()
  const pageH = doc.internal.pageSize.getHeight()
  const margin = 10

  // ── Brand header (bold) ──
  doc.setFont(fontName, 'normal')
  doc.setFontSize(16)
  setBold(doc, [139, 115, 85], 0.5)
  doc.text('阿爸的芋圓', margin, 12)
  endBold(doc)

  doc.setFontSize(13)
  setBold(doc, [60, 46, 38], 0.4)
  doc.text('各店叫貨總表', 55, 12)
  endBold(doc)

  doc.setFontSize(12)
  setBold(doc, [100, 90, 80], 0.3)
  doc.text(formatDateCN(date), pageW - margin, 12, { align: 'right' })
  endBold(doc)

  doc.setDrawColor(139, 115, 85)
  doc.setLineWidth(0.5)
  doc.line(margin, 15, pageW - margin, 15)

  const tableStartY = 17

  // ── Build table data ──
  // 欄位順序：品項 → 庫存 → 門店需求... → 加總 → 剩餘庫存
  const storeCount = stores.length
  const colCount = storeCount + 4  // name + stock + stores + total + remaining

  type RowType = 'category' | 'product'
  interface RowMeta { type: RowType; category: string; productId?: string; unit?: string }
  const rowMeta: RowMeta[] = []
  const body: string[][] = []

  for (const cat of categories) {
    const catProducts = products.filter(p => p.category === cat)
    if (catProducts.length === 0) continue

    rowMeta.push({ type: 'category', category: cat })
    const catRow = new Array(colCount).fill('')
    catRow[0] = `■ ${cat}`
    body.push(catRow)

    for (const product of catProducts) {
      const storeQtys = stores.map(s => storeOrders[s.id]?.[product.id] || 0)
      const total = Math.round(storeQtys.reduce((a, b) => a + b, 0) * 10) / 10
      const stockQty = productStock[product.id]
      const remaining = stockQty != null ? Math.round((stockQty - total) * 10) / 10 : null

      const row: string[] = [
        product.name,
        stockQty != null ? String(stockQty) : '-',
        ...storeQtys.map(q => q > 0 ? `${q} ${product.unit}` : '-'),
        total > 0 ? `${total} ${product.unit}` : '-',
        remaining != null ? remaining.toFixed(1) : '-',
      ]
      rowMeta.push({ type: 'product', category: cat, productId: product.id, unit: product.unit })
      body.push(row)
    }
  }

  // ── Auto-fill sizing: 目標一頁 A4 塞完 ──
  const totalRows = body.length
  const notesReserve = 22
  const availableH = pageH - tableStartY - notesReserve
  const tableHeaderH = 7
  const targetRowH = (availableH - tableHeaderH) / totalRows
  const cellPad = Math.min(2, Math.max(0.8, targetRowH * 0.18))
  const fontSize = Math.min(11, Math.max(7, (targetRowH - cellPad * 2) / 0.42))
  const numFontSize = fontSize + 0.5  // 數字欄（門店/加總/庫存）略大
  const headFontSize = fontSize + 0.5

  // ── Column widths ──
  // col 0=品項, 1=庫存(窄), 2..storeCount+1=門店(寬), storeCount+2=加總(寬), storeCount+3=剩餘庫存(中)
  const tableW = pageW - margin * 2
  const stockColW = 18    // 庫存：窄，僅顯示數字
  const remainingColW = 22 // 剩餘庫存：中等，需顯示 4 字表頭
  const nameColW = Math.round(tableW * 0.24)
  const storeAreaW = tableW - nameColW - stockColW - remainingColW
  const storeColW = Math.floor(storeAreaW / (storeCount + 1))  // 門店 + 加總均分
  const totalColW = storeAreaW - storeColW * storeCount  // 加總拿剩餘

  const colWidths: Record<number, { cellWidth: number }> = { 0: { cellWidth: nameColW } }
  colWidths[1] = { cellWidth: stockColW }  // 庫存
  stores.forEach((_, i) => { colWidths[i + 2] = { cellWidth: storeColW } })
  colWidths[storeCount + 2] = { cellWidth: totalColW }  // 加總
  colWidths[storeCount + 3] = { cellWidth: remainingColW }  // 剩餘庫存

  const head = ['品項', '庫存', ...stores.map(s => s.name.replace('店', '') + '需求'), '加總', '剩餘庫存']

  let finalY = tableStartY

  autoTable(doc, {
    startY: tableStartY,
    head: [head],
    body,
    styles: {
      font: fontName,
      fontSize,
      cellPadding: cellPad,
      halign: 'center',
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
      halign: 'center',
      cellPadding: cellPad + 0.5,
      fontSize: headFontSize,
    },
    columnStyles: { ...colWidths, 0: { ...colWidths[0], halign: 'left' } },
    margin: { left: margin, right: margin },

    willDrawCell: (hookData) => {
      if (hookData.section === 'head') {
        // 表頭文字也用粗體
        hookData.cell.text = []
      }
      if (hookData.section !== 'body') return
      const meta = rowMeta[hookData.row.index]
      if (!meta) return
      if (meta.type === 'category') hookData.cell.text = []
    },

    didDrawCell: (hookData) => {
      // ── 表頭粗體 ──
      if (hookData.section === 'head') {
        const cell = hookData.cell
        const colIdx = hookData.column.index
        const text = head[colIdx] || ''
        doc.setFont(fontName, 'normal')
        doc.setFontSize(headFontSize)
        setBold(doc, [255, 255, 255], 0.4)
        doc.text(text, cell.x + cell.width / 2, cell.y + cell.height / 2, {
          align: 'center',
          baseline: 'middle',
        })
        endBold(doc)
        return
      }

      if (hookData.section !== 'body') return
      const meta = rowMeta[hookData.row.index]
      if (!meta) return

      const cell = hookData.cell
      const colIdx = hookData.column.index

      // ── 分類行 ──
      if (meta.type === 'category') {
        const headerColor = getCategoryHeaderColor(meta.category)
        doc.setFillColor(...headerColor)
        doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
        doc.setDrawColor(200, 195, 185)
        doc.setLineWidth(0.15)
        doc.rect(cell.x, cell.y, cell.width, cell.height, 'S')

        if (colIdx === 0) {
          doc.setFont(fontName, 'normal')
          doc.setFontSize(fontSize + 1)
          setBold(doc, [60, 46, 38], 0.4)
          doc.text(`■ ${meta.category}`, cell.x + 2, cell.y + cell.height / 2, { baseline: 'middle' })
          endBold(doc)
        }
        return
      }

      // ── 品項行 ──
      // col 0=品項, 1=庫存, 2..storeCount+1=門店, storeCount+2=加總, storeCount+3=剩餘庫存
      if (meta.type === 'product') {
        const cellText = hookData.cell.text.join('')

        // 庫存欄（col 1, amber 品牌色淺底）
        if (colIdx === 1) {
          doc.setFillColor(245, 235, 210)
          doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
          doc.setDrawColor(200, 195, 185)
          doc.setLineWidth(0.15)
          doc.rect(cell.x, cell.y, cell.width, cell.height, 'S')
          doc.setFont(fontName, 'normal')
          doc.setFontSize(numFontSize)
          const color: [number, number, number] = cellText === '-' ? [180, 180, 180] : [60, 46, 38]
          setBold(doc, color, 0.35)
          doc.text(cellText, cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' })
          endBold(doc)
          hookData.cell.text = []
          return
        }

        // 加總欄（col storeCount+2）
        if (colIdx === storeCount + 2) {
          const hasValue = cellText !== '-'
          if (hasValue) {
            doc.setFillColor(247, 235, 234)
            doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
            doc.setDrawColor(201, 130, 125)
            doc.setLineWidth(0.4)
            doc.rect(cell.x + 0.3, cell.y + 0.3, cell.width - 0.6, cell.height - 0.6, 'S')
            doc.setFont(fontName, 'normal')
            doc.setFontSize(numFontSize)
            setBold(doc, [30, 80, 180], 0.45)
            doc.text(cellText, cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' })
            endBold(doc)
          } else {
            const bgColor = getCategoryColor(meta.category)
            doc.setFillColor(...bgColor)
            doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
            doc.setDrawColor(200, 195, 185)
            doc.setLineWidth(0.15)
            doc.rect(cell.x, cell.y, cell.width, cell.height, 'S')
            doc.setFont(fontName, 'normal')
            doc.setFontSize(fontSize)
            setBold(doc, [180, 180, 180], 0.2)
            doc.text('-', cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' })
            endBold(doc)
          }
          hookData.cell.text = []
          return
        }

        // 剩餘庫存欄（col storeCount+3）
        if (colIdx === storeCount + 3) {
          const val = parseFloat(cellText)
          const hasValue = cellText !== '-' && !isNaN(val)
          if (hasValue) {
            const bgColor: [number, number, number] = val < 0 ? [255, 235, 235] : [230, 245, 230]
            const textColor: [number, number, number] = val < 0 ? [200, 50, 50] : [30, 120, 50]
            doc.setFillColor(...bgColor)
            doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
            doc.setDrawColor(200, 195, 185)
            doc.setLineWidth(0.15)
            doc.rect(cell.x, cell.y, cell.width, cell.height, 'S')
            doc.setFont(fontName, 'normal')
            doc.setFontSize(numFontSize)
            setBold(doc, textColor, 0.4)
            doc.text(cellText, cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' })
            endBold(doc)
          } else {
            const bgColor = getCategoryColor(meta.category)
            doc.setFillColor(...bgColor)
            doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
            doc.setDrawColor(200, 195, 185)
            doc.setLineWidth(0.15)
            doc.rect(cell.x, cell.y, cell.width, cell.height, 'S')
            doc.setFont(fontName, 'normal')
            doc.setFontSize(fontSize)
            setBold(doc, [180, 180, 180], 0.2)
            doc.text('-', cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' })
            endBold(doc)
          }
          hookData.cell.text = []
          return
        }

        // 品名 & 門店欄
        const bgColor = getCategoryColor(meta.category)
        doc.setFillColor(...bgColor)
        doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
        doc.setDrawColor(200, 195, 185)
        doc.setLineWidth(0.15)
        doc.rect(cell.x, cell.y, cell.width, cell.height, 'S')

        doc.setFont(fontName, 'normal')
        if (colIdx === 0) {
          // 品名：用 base fontSize
          doc.setFontSize(fontSize)
          setBold(doc, [60, 46, 38], 0.3)
          doc.text(cellText, cell.x + 2, cell.y + cell.height / 2, { baseline: 'middle' })
          endBold(doc)
        } else {
          // 門店數字：與加總同大
          doc.setFontSize(numFontSize)
          const color: [number, number, number] = cellText === '-' ? [180, 180, 180] : [30, 80, 180]
          const sw = cellText === '-' ? 0.2 : 0.4
          setBold(doc, color, sw)
          doc.text(cellText, cell.x + cell.width / 2, cell.y + cell.height / 2, { align: 'center', baseline: 'middle' })
          endBold(doc)
        }
        hookData.cell.text = []
      }
    },

    didDrawPage: (hookData) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalY = (hookData as any).cursor?.y ?? finalY
    },
  })

  // ── 備註區（粗體） ──
  const notesY = finalY + 3
  if (notesY < pageH - 20) {
    doc.setDrawColor(139, 115, 85)
    doc.setLineWidth(0.3)
    doc.line(margin, notesY, pageW - margin, notesY)

    doc.setFont(fontName, 'normal')
    doc.setFontSize(10)
    setBold(doc, [90, 70, 50], 0.4)
    doc.text('各店叫貨備註', margin, notesY + 5)
    endBold(doc)

    let ny = notesY + 10
    for (const store of stores) {
      const n = storeNotes[store.id]
      doc.setFont(fontName, 'normal')
      doc.setFontSize(9)
      setBold(doc, [60, 46, 38], 0.35)
      doc.text(`${store.name}：`, margin + 2, ny)
      endBold(doc)

      const parts: string[] = []
      if (n) {
        fixedNoteItems.forEach(item => {
          const qty = n.fixedItems[item.id] || 0
          if (qty > 0) parts.push(`${item.label} ${qty}${item.unit}`)
        })
        if (n.freeText) parts.push(n.freeText)
      }

      const noteText = parts.length > 0 ? parts.join('、') : '無備註'
      setBold(doc, [80, 70, 60], 0.3)
      doc.text(noteText, margin + 24, ny)
      endBold(doc)
      ny += 6
    }
  }

  const dateStr = date.replace(/-/g, '')
  await savePdfCompat(doc, `叫貨總表_${dateStr}.pdf`)
}
