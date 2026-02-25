import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadNotoSansTC } from '@/assets/notoSansTC'
import {
  formatShortDate,
  getWeekdayLabel,
  formatTime,
  getAttendanceType,
  getTagColor,
} from '@/lib/schedule'
import type { ShiftType, Schedule } from '@/lib/schedule'
import type { StaffMember } from '@/data/staff'

export interface SchedulePdfOptions {
  title: string
  dateRange: string
  weekDates: string[]       // 7 or 14 days
  staff: StaffMember[]
  schedules: Schedule[]
  shiftTypes: ShiftType[]
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
    console.warn('[exportSchedulePdf] Font registration failed:', e)
    return false
  }
}

function hexToRgb(hex: string): [number, number, number] {
  if (!hex || typeof hex !== 'string') return [0, 0, 0]
  const h = hex.replace('#', '')
  const r = parseInt(h.substring(0, 2), 16)
  const g = parseInt(h.substring(2, 4), 16)
  const b = parseInt(h.substring(4, 6), 16)
  return [
    isFinite(r) ? r : 0,
    isFinite(g) ? g : 0,
    isFinite(b) ? b : 0,
  ]
}

function isLightColor(r: number, g: number, b: number): boolean {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

interface TagRender {
  name: string
  bg: [number, number, number]
  text: [number, number, number]
}

interface CellRender {
  shiftName: string | null
  timeRange: string | null
  tags: TagRender[]
  badgeFill: [number, number, number] | null
  badgeText: [number, number, number]
}

function buildCellRender(
  sch: Schedule | undefined,
  shiftMap: Record<string, ShiftType>,
): CellRender | null {
  if (!sch) return null

  const at = sch.attendance_type || 'work'

  if (at !== 'work') {
    const leave = getAttendanceType(at)
    if (!leave) return null
    return {
      shiftName: leave.name,
      timeRange: null,
      tags: [],
      badgeFill: hexToRgb(leave.color),
      badgeText: hexToRgb(leave.textColor),
    }
  }

  let shiftName: string | null = null
  let timeRange: string | null = null
  let badgeFill: [number, number, number] | null = null

  if (sch.shift_type_id && shiftMap[sch.shift_type_id]) {
    const st = shiftMap[sch.shift_type_id]
    shiftName = st.name
    timeRange = `${formatTime(st.start_time)}-${formatTime(st.end_time)}`
    if (st.color) badgeFill = hexToRgb(st.color)
  } else if (sch.custom_start && sch.custom_end) {
    timeRange = `${formatTime(sch.custom_start)}-${formatTime(sch.custom_end)}`
  }

  const tags: TagRender[] = (sch.tags || []).map((t) => {
    const tc = getTagColor(t)
    return { name: t, bg: hexToRgb(tc.bg), text: hexToRgb(tc.text) }
  })

  if (!shiftName && !timeRange && tags.length === 0) return null

  const badgeText: [number, number, number] = badgeFill
    ? (isLightColor(...badgeFill) ? [60, 46, 38] : [255, 255, 255])
    : [60, 46, 38]

  return { shiftName, timeRange, tags, badgeFill, badgeText }
}

// ── Render one schedule table and return the Y position after it ──
function renderScheduleTable(
  doc: jsPDF,
  fontName: string,
  dates: string[],
  staff: StaffMember[],
  scheduleMap: Record<string, Schedule>,
  shiftMap: Record<string, ShiftType>,
  startY: number,
  compact: boolean,
): number {
  // Build cell render data for this table
  const renderMap: Record<string, CellRender> = {}
  staff.forEach((member, rowIdx) => {
    dates.forEach((date, colIdx) => {
      const sch = scheduleMap[`${member.id}_${date}`]
      const render = buildCellRender(sch, shiftMap)
      if (render) {
        renderMap[`${rowIdx}_${colIdx + 1}`] = render
      }
    })
  })

  const head = [
    '員工',
    ...dates.map((d) => `${getWeekdayLabel(d)} ${formatShortDate(d)}`),
  ]

  const body = staff.map((member, rowIdx) => [
    member.name,
    ...dates.map((_date, colIdx) => {
      const key = `${rowIdx}_${colIdx + 1}`
      const r = renderMap[key]
      if (!r) return '-'
      const lines: string[] = []
      if (r.shiftName) lines.push(r.shiftName)
      if (r.timeRange) lines.push(r.timeRange)
      if (r.tags.length > 0) lines.push(r.tags.map((t) => t.name).join(' '))
      return lines.join('\n') || '-'
    }),
  ])

  // Sizing based on compact mode
  const fontSize = compact ? 6 : 7.5
  const headFontSize = compact ? 6 : 7.5
  const cellPad = compact ? 1.5 : 2.5
  const minH = compact ? 10 : 14
  const nameW = compact ? 18 : 22
  const badgePad = compact ? 1 : 1.5
  const badgeR = compact ? 1.5 : 2
  const nameFontSize = compact ? 6.5 : 8
  const timeFontSize = compact ? 5.5 : 6.5
  const tagFontSize = compact ? 4.5 : 5.5
  const lineGap = compact ? 3.2 : 3.8
  const tagPillH = compact ? 2.6 : 3.2

  let finalY = startY

  autoTable(doc, {
    startY,
    head: [head],
    body,
    styles: {
      font: fontName,
      fontSize,
      cellPadding: cellPad,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.15,
      lineColor: [230, 225, 220],
      minCellHeight: minH,
    },
    headStyles: {
      fillColor: [139, 115, 85],
      textColor: 255,
      fontStyle: 'normal',
      font: fontName,
      halign: 'center',
      cellPadding: cellPad,
      fontSize: headFontSize,
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: nameW },
    },
    alternateRowStyles: {
      fillColor: [252, 250, 248],
    },
    margin: { left: 14, right: 14 },

    willDrawCell: (hookData) => {
      if (hookData.section !== 'body') return
      const key = `${hookData.row.index}_${hookData.column.index}`
      if (renderMap[key]) {
        hookData.cell.text = []
      }
    },

    didDrawCell: (hookData) => {
      if (hookData.section !== 'body') return
      if (hookData.column.index === 0) return

      const key = `${hookData.row.index}_${hookData.column.index}`
      const r = renderMap[key]
      if (!r) return

      const cell = hookData.cell
      const cx = cell.x
      const cy = cell.y
      const cw = cell.width
      const ch = cell.height

      const badgeX = cx + badgePad
      const badgeY = cy + badgePad
      const badgeW = cw - badgePad * 2
      const badgeH = ch - badgePad * 2

      if (r.badgeFill) {
        doc.setFillColor(...r.badgeFill)
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, badgeR, badgeR, 'F')
      }

      doc.setFont(fontName, 'normal')
      const centerX = cx + cw / 2
      const hasTags = r.tags.length > 0
      const lineCount = (r.shiftName ? 1 : 0) + (r.timeRange ? 1 : 0)
      const tagHeight = hasTags ? tagPillH + 1.5 : 0
      const textBlockHeight = lineCount * lineGap + tagHeight
      let textY = cy + (ch - textBlockHeight) / 2 + (compact ? 2.5 : 3)

      if (r.shiftName) {
        doc.setFontSize(nameFontSize)
        doc.setTextColor(...r.badgeText)
        doc.text(r.shiftName, centerX, textY, { align: 'center' })
        textY += lineGap
      }

      if (r.timeRange) {
        doc.setFontSize(timeFontSize)
        const timeColor: [number, number, number] = r.badgeFill
          ? r.badgeText : [120, 110, 100]
        doc.setTextColor(...timeColor)
        doc.text(r.timeRange, centerX, textY, { align: 'center' })
        textY += lineGap
      }

      if (hasTags) {
        doc.setFontSize(tagFontSize)
        let totalTagW = 0
        const tagWidths: number[] = []
        r.tags.forEach((tag) => {
          const tw = doc.getTextWidth(tag.name) + 2
          tagWidths.push(tw)
          totalTagW += tw
        })
        totalTagW += (r.tags.length - 1) * 0.8

        let tagX = centerX - totalTagW / 2
        const tagY = textY

        r.tags.forEach((tag, i) => {
          const tw = tagWidths[i]
          doc.setFillColor(...tag.bg)
          doc.roundedRect(tagX, tagY - 2, tw, tagPillH, 0.8, 0.8, 'F')
          doc.setTextColor(...tag.text)
          doc.text(tag.name, tagX + tw / 2, tagY, { align: 'center' })
          tagX += tw + 0.8
        })
      }
    },

    didDrawPage: (hookData) => {
      // Track final Y for stacking tables
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      finalY = (hookData as any).cursor?.y ?? startY + 100
    },
  })

  return finalY
}

export async function exportScheduleToPdf({
  title,
  dateRange,
  weekDates,
  staff,
  schedules,
  shiftTypes,
  fileName,
}: SchedulePdfOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const hasCJK = await registerFont(doc)
  const fontName = hasCJK ? 'NotoSansTC' : 'helvetica'

  // ── Build lookup maps ──
  const shiftMap: Record<string, ShiftType> = {}
  shiftTypes.forEach((st) => { shiftMap[st.id] = st })

  const scheduleMap: Record<string, Schedule> = {}
  schedules.forEach((s) => { scheduleMap[`${s.staff_id}_${s.date}`] = s })

  // ── Brand header ──
  doc.setFontSize(14)
  doc.setFont(fontName, 'normal')
  doc.setTextColor(139, 115, 85)
  doc.text('\u963F\u7238\u7684\u828B\u5713', 14, 13)

  doc.setFontSize(11)
  doc.setTextColor(60, 46, 38)
  doc.text(title, 14, 20)

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(dateRange, 14, 26)
  doc.setTextColor(0, 0, 0)

  const isMultiWeek = weekDates.length > 7

  if (!isMultiWeek) {
    // ── Single week: one table ──
    renderScheduleTable(doc, fontName, weekDates, staff, scheduleMap, shiftMap, 30, false)
  } else {
    // ── Multi-week: split into 7-day chunks, stacked ──
    const chunks: string[][] = []
    for (let i = 0; i < weekDates.length; i += 7) {
      chunks.push(weekDates.slice(i, i + 7))
    }

    let currentY = 30
    chunks.forEach((chunk, idx) => {
      // Sub-header for each week
      const label = `${formatShortDate(chunk[0])}（${getWeekdayLabel(chunk[0])}）～ ${formatShortDate(chunk[chunk.length - 1])}（${getWeekdayLabel(chunk[chunk.length - 1])}）`
      doc.setFontSize(7)
      doc.setFont(fontName, 'normal')
      doc.setTextColor(140, 130, 120)
      doc.text(label, 14, currentY)
      currentY += 2.5

      currentY = renderScheduleTable(
        doc, fontName, chunk, staff, scheduleMap, shiftMap, currentY, true,
      )

      if (idx < chunks.length - 1) {
        currentY += 3 // gap between tables
      }
    })
  }

  // ── Page numbers ──
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `${i} / ${totalPages}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' },
    )
  }

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}

// ── Calendar (monthly) PDF export ──────────────────────────────────

export interface CalendarPdfOptions {
  title: string
  year: number
  month: number // 1-based
  staff: StaffMember[]
  schedules: Schedule[]
  shiftTypes: ShiftType[]
  fileName: string
}

/** Build calendar weeks for PDF: array of 7-element arrays (Mon-Sun), null for outside-month */
function buildPdfCalendarWeeks(year: number, month: number): (string | null)[][] {
  const daysInMonth = new Date(year, month, 0).getDate()
  const firstDow = new Date(year, month - 1, 1).getDay()
  const startOffset = (firstDow + 6) % 7 // Mon=0

  const weeks: (string | null)[][] = []
  let week: (string | null)[] = []

  for (let i = 0; i < startOffset; i++) week.push(null)

  for (let day = 1; day <= daysInMonth; day++) {
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    week.push(dateStr)
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
  }

  if (week.length > 0) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }

  return weeks
}

export async function exportCalendarScheduleToPdf({
  title,
  year,
  month,
  staff,
  schedules,
  shiftTypes,
  fileName,
}: CalendarPdfOptions) {
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })

  const hasCJK = await registerFont(doc)
  const fontName = hasCJK ? 'NotoSansTC' : 'helvetica'

  // Build lookup maps
  const shiftMap: Record<string, ShiftType> = {}
  shiftTypes.forEach((st) => { shiftMap[st.id] = st })

  const staffMap: Record<string, StaffMember> = {}
  staff.forEach((s) => { staffMap[s.id] = s })

  // Staff-based color palette (matches CalendarGrid.tsx)
  const STAFF_PALETTE: { bg: [number, number, number]; text: [number, number, number] }[] = [
    { bg: [232, 213, 196], text: [93, 64, 55] },   // 奶茶
    { bg: [200, 230, 201], text: [46, 125, 50] },   // 抹茶
    { bg: [187, 222, 251], text: [21, 101, 192] },   // 天藍
    { bg: [248, 187, 208], text: [173, 20, 87] },   // 櫻粉
    { bg: [209, 196, 233], text: [69, 39, 160] },   // 薰衣草
    { bg: [255, 224, 178], text: [230, 81, 0] },    // 橘果
    { bg: [178, 223, 219], text: [0, 105, 92] },    // 薄荷
    { bg: [255, 205, 210], text: [200, 40, 40] },   // 莓紅
    { bg: [255, 249, 196], text: [245, 127, 23] },  // 檸檬
    { bg: [207, 216, 220], text: [55, 71, 79] },    // 灰藍
    { bg: [220, 237, 200], text: [85, 139, 47] },   // 青蘋果
    { bg: [240, 244, 195], text: [158, 157, 36] },  // 萊姆
  ]
  const staffColorMap: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {}
  staff.forEach((s, i) => {
    staffColorMap[s.id] = STAFF_PALETTE[i % STAFF_PALETTE.length]
  })

  // date → Schedule[]
  const dateSchedules: Record<string, Schedule[]> = {}
  schedules.forEach((s) => {
    if (!dateSchedules[s.date]) dateSchedules[s.date] = []
    dateSchedules[s.date].push(s)
  })

  // ── Brand header ──
  doc.setFontSize(14)
  doc.setFont(fontName, 'normal')
  doc.setTextColor(139, 115, 85)
  doc.text('\u963F\u7238\u7684\u828B\u5713', 14, 13)

  doc.setFontSize(11)
  doc.setTextColor(60, 46, 38)
  doc.text(title, 14, 20)

  doc.setFontSize(8)
  doc.setTextColor(120, 120, 120)
  doc.text(`${year}年${month}月`, 14, 26)
  doc.setTextColor(0, 0, 0)

  // Build calendar weeks
  const weeks = buildPdfCalendarWeeks(year, month)
  const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

  // Helper: get cell text content for a date (work only, no leaves)
  function getCellContent(date: string | null): string {
    if (!date) return ''
    const dayNum = new Date(date + 'T00:00:00').getDate()
    const daySchedules = dateSchedules[date] || []
    const lines: string[] = [String(dayNum)]

    daySchedules.forEach((sch) => {
      const at = sch.attendance_type || 'work'
      if (at !== 'work') return
      const member = staffMap[sch.staff_id]
      if (!member) return
      const render = buildCellRender(sch, shiftMap)
      if (!render) return
      const parts = [member.name]
      if (render.shiftName) parts.push(render.shiftName)
      else if (render.timeRange) parts.push(render.timeRange)
      if (render.tags.length > 0) parts.push(render.tags.map((t) => t.name).join(' '))
      lines.push(parts.join(' '))
    })

    return lines.join('\n')
  }

  // Build table data
  const head = [weekdayLabels]
  const body = weeks.map((week) =>
    week.map((date) => getCellContent(date))
  )

  // Staff order for consistent sorting
  const staffOrderMap: Record<string, number> = {}
  staff.forEach((s, i) => { staffOrderMap[s.id] = i })
  const sortByStaffOrder = (arr: CalendarEntry[]) =>
    arr.sort((a, b) => (staffOrderMap[a.staffId] ?? 999) - (staffOrderMap[b.staffId] ?? 999))

  // Shift cutoff: < 17 = afternoon, >= 17 = evening
  const SHIFT_CUTOFF = 17
  function isAfternoon(sch: Schedule): boolean {
    if (sch.shift_type_id && shiftMap[sch.shift_type_id]) {
      const hour = parseInt(shiftMap[sch.shift_type_id].start_time.split(':')[0], 10)
      return hour < SHIFT_CUTOFF
    }
    if (sch.custom_start) {
      const hour = parseInt(sch.custom_start.split(':')[0], 10)
      return hour < SHIFT_CUTOFF
    }
    return true
  }

  // Render map for custom cell drawing: `row_col` → { date, afternoon, evening }
  interface CalendarEntry {
    staffName: string
    staffId: string
    render: CellRender
  }
  interface CalendarCellData {
    date: string
    dayNum: number
    afternoon: CalendarEntry[]
    evening: CalendarEntry[]
  }
  const cellDataMap: Record<string, CalendarCellData> = {}

  weeks.forEach((week, rowIdx) => {
    week.forEach((date, colIdx) => {
      if (!date) return
      const daySchedules = dateSchedules[date] || []
      const afternoon: CalendarEntry[] = []
      const evening: CalendarEntry[] = []
      daySchedules.forEach((sch) => {
        const at = sch.attendance_type || 'work'
        if (at !== 'work') return // hide leaves
        const member = staffMap[sch.staff_id]
        if (!member) return
        const render = buildCellRender(sch, shiftMap)
        if (!render) return
        const entry: CalendarEntry = { staffName: member.name, staffId: sch.staff_id, render }
        if (isAfternoon(sch)) afternoon.push(entry)
        else evening.push(entry)
      })
      sortByStaffOrder(afternoon)
      sortByStaffOrder(evening)
      cellDataMap[`${rowIdx}_${colIdx}`] = {
        date,
        dayNum: new Date(date + 'T00:00:00').getDate(),
        afternoon,
        evening,
      }
    })
  })

  // Adaptive cell height based on week count
  const pageH = doc.internal.pageSize.getHeight()
  const tableStartY = 30
  const availableH = pageH - tableStartY - 10 // bottom margin
  const headerRowH = 7
  const rowH = Math.max(16, (availableH - headerRowH) / weeks.length)

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    styles: {
      font: fontName,
      fontSize: 5.5,
      cellPadding: 1,
      halign: 'left',
      valign: 'top',
      lineWidth: 0.15,
      lineColor: [230, 225, 220],
      minCellHeight: rowH,
      overflow: 'hidden',
    },
    headStyles: {
      fillColor: [139, 115, 85],
      textColor: 255,
      fontStyle: 'normal',
      font: fontName,
      halign: 'center',
      cellPadding: 1.5,
      fontSize: 7,
      minCellHeight: headerRowH,
    },
    alternateRowStyles: {
      fillColor: [252, 250, 248],
    },
    margin: { left: 10, right: 10 },

    willDrawCell: (hookData) => {
      if (hookData.section !== 'body') return
      const key = `${hookData.row.index}_${hookData.column.index}`
      if (cellDataMap[key] || !weeks[hookData.row.index][hookData.column.index]) {
        hookData.cell.text = []
      }
    },

    didDrawCell: (hookData) => {
      if (hookData.section !== 'body') return

      const rowIdx = hookData.row.index
      const colIdx = hookData.column.index
      const date = weeks[rowIdx]?.[colIdx]

      if (!date) {
        // Gray out empty cells
        const cell = hookData.cell
        doc.setFillColor(245, 243, 240)
        doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
        return
      }

      const key = `${rowIdx}_${colIdx}`
      const data = cellDataMap[key]
      if (!data) return

      const cell = hookData.cell
      const cx = cell.x + 1
      let cy = cell.y + 1

      // Day number
      doc.setFont(fontName, 'normal')
      doc.setFontSize(7)
      doc.setTextColor(60, 46, 38)
      doc.text(String(data.dayNum), cx, cy + 3)
      cy += 5

      const entryH = 3.2
      const sectionLabelW = 4
      const midY = cell.y + 1 + 5 + (cell.height - 6) / 2

      // Helper: render entries in a section
      const renderEntries = (entries: CalendarEntry[], startY: number, endY: number, label: string) => {
        // Section label
        doc.setFontSize(4)
        doc.setTextColor(180, 170, 160)
        doc.text(label, cx, startY + 2.5)

        const maxEntries = Math.floor((endY - startY) / entryH)
        let ey = startY
        entries.slice(0, maxEntries).forEach((entry) => {
          const staffColor = staffColorMap[entry.staffId]
          const badgeBg = staffColor?.bg || [107, 93, 85] as [number, number, number]
          const badgeTextColor = staffColor?.text || [255, 255, 255] as [number, number, number]

          doc.setFillColor(...badgeBg)
          doc.roundedRect(cx + sectionLabelW, ey - 0.5, cell.width - 2 - sectionLabelW, entryH - 0.3, 0.8, 0.8, 'F')

          doc.setFontSize(5)
          doc.setTextColor(...badgeTextColor)

          const r = entry.render
          let text = entry.staffName
          if (r.shiftName) text += ` ${r.shiftName}`
          else if (r.timeRange) text += ` ${r.timeRange}`

          const maxW = cell.width - 3 - sectionLabelW
          while (doc.getTextWidth(text) > maxW && text.length > 3) {
            text = text.slice(0, -2) + '…'
          }

          doc.text(text, cx + sectionLabelW + 0.5, ey + 2)
          ey += entryH
        })

        if (entries.length > maxEntries) {
          doc.setFontSize(4)
          doc.setTextColor(140, 130, 120)
          doc.text(`+${entries.length - maxEntries}`, cx + sectionLabelW + 0.5, ey + 1.5)
        }
      }

      // Afternoon section
      renderEntries(data.afternoon, cy, midY - 0.5, '午')

      // Divider line
      doc.setDrawColor(180, 170, 160)
      doc.setLineWidth(0.15)
      doc.line(cell.x + 1, midY, cell.x + cell.width - 1, midY)

      // Evening section
      renderEntries(data.evening, midY + 1, cell.y + cell.height - 1, '晚')
    },
  })

  // Page numbers
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(7)
    doc.setTextColor(160, 160, 160)
    doc.text(
      `${i} / ${totalPages}`,
      doc.internal.pageSize.getWidth() / 2,
      doc.internal.pageSize.getHeight() - 6,
      { align: 'center' },
    )
  }

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}
