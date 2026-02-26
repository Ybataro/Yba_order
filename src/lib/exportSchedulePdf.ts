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

  // Merge schedule tags + shift type tags (like getEffectiveTags in CalendarGrid)
  const allTagNames: string[] = [...(sch.tags || [])]
  if (sch.shift_type_id && shiftMap[sch.shift_type_id]) {
    const st = shiftMap[sch.shift_type_id]
    if (st.tags?.length) {
      for (const t of st.tags) {
        if (!allTagNames.includes(t)) allTagNames.push(t)
      }
    }
  }
  const tags: TagRender[] = allTagNames.map((t) => {
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

// ── Bold text helpers (fill+stroke rendering mode) ──
function calSetBold(doc: jsPDF, color: [number, number, number], strokeW = 0.35) {
  doc.setTextColor(...color)
  doc.setDrawColor(...color)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).internal.write(`2 Tr ${strokeW} w`)
}

function calEndBold(doc: jsPDF) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(doc as any).internal.write('0 Tr 0 w')
  doc.setDrawColor(200, 195, 185)
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
  const pageW = doc.internal.pageSize.getWidth()   // 297
  const pageH = doc.internal.pageSize.getHeight()   // 210

  const hasCJK = await registerFont(doc)
  const fontName = hasCJK ? 'NotoSansTC' : 'helvetica'

  const margin = 5  // top/bottom
  const marginLR = 15 // left/right (1.5cm)

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

  // ── Collect active staff for legend (only those with schedules this month) ──
  const activeStaffIds = new Set<string>()
  schedules.forEach((s) => { activeStaffIds.add(s.staff_id) })
  const legendStaff = staff.filter((s) => activeStaffIds.has(s.id))

  // ── Single-line header: brand + title + year/month + legend ──
  const headerY = margin + 5.5
  doc.setFont(fontName, 'normal')

  // Brand name (bold)
  doc.setFontSize(11)
  calSetBold(doc, [139, 115, 85], 0.45)
  doc.text('\u963F\u7238\u7684\u828B\u5713', marginLR, headerY)
  calEndBold(doc)

  // Separator dot
  doc.setFontSize(9)
  doc.setTextColor(180, 170, 160)
  const brandW = doc.getTextWidth('\u963F\u7238\u7684\u828B\u5713 ')
  doc.text('\u2027', marginLR + brandW, headerY)

  // Title
  doc.setFontSize(10)
  calSetBold(doc, [60, 46, 38], 0.35)
  const titleX = marginLR + brandW + 3
  doc.text(title, titleX, headerY)
  calEndBold(doc)

  // Separator dot + year/month
  const titleW = doc.getTextWidth(title + ' ')
  doc.setFontSize(9)
  doc.setTextColor(180, 170, 160)
  doc.text('\u2027', titleX + titleW, headerY)

  doc.setFontSize(9)
  calSetBold(doc, [100, 90, 80], 0.3)
  const ymX = titleX + titleW + 3
  doc.text(`${year}\u5E74${month}\u6708`, ymX, headerY)
  calEndBold(doc)

  // Legend — right-aligned, same line
  const legendBlockSize = 3.5
  const legendGap = 1.5
  const legendFontSize = 8
  doc.setFontSize(legendFontSize)

  // Calculate total legend width first
  let totalLegendW = 0
  legendStaff.forEach((s, i) => {
    const nameW = doc.getTextWidth(s.name)
    totalLegendW += legendBlockSize + 1.2 + nameW
    if (i < legendStaff.length - 1) totalLegendW += legendGap + 1
  })

  let legendX = pageW - marginLR - totalLegendW
  const legendCenterY = headerY - 1.5

  legendStaff.forEach((s, i) => {
    const color = staffColorMap[s.id]
    if (!color) return

    // Color block
    doc.setFillColor(...color.bg)
    doc.roundedRect(legendX, legendCenterY - 1.5, legendBlockSize, legendBlockSize, 0.5, 0.5, 'F')
    doc.setDrawColor(...color.text)
    doc.setLineWidth(0.15)
    doc.roundedRect(legendX, legendCenterY - 1.5, legendBlockSize, legendBlockSize, 0.5, 0.5, 'S')

    // Name
    legendX += legendBlockSize + 1.2
    doc.setFont(fontName, 'normal')
    doc.setFontSize(legendFontSize)
    calSetBold(doc, color.text, 0.25)
    doc.text(s.name, legendX, legendCenterY + 1.5)
    calEndBold(doc)

    legendX += doc.getTextWidth(s.name) + legendGap + 1
    void i
  })

  // Header separator line
  const separatorY = headerY + 2
  doc.setDrawColor(139, 115, 85)
  doc.setLineWidth(0.4)
  doc.line(marginLR, separatorY, pageW - marginLR, separatorY)

  // Build calendar weeks
  const weeks = buildPdfCalendarWeeks(year, month)
  const weekdayLabels = ['\u4E00', '\u4E8C', '\u4E09', '\u56DB', '\u4E94', '\u516D', '\u65E5']

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

  // ── Bright leave colors for PDF (亮色系) ──
  const LEAVE_PDF_COLORS: Record<string, { bg: [number, number, number]; text: [number, number, number] }> = {
    rest_day:          { bg: [230, 238, 255], text: [60, 90, 180] },     // 亮藍灰
    regular_leave:     { bg: [225, 232, 250], text: [50, 75, 160] },     // 靛藍
    national_holiday:  { bg: [255, 225, 225], text: [210, 50, 50] },     // 亮紅
    annual_leave:      { bg: [215, 240, 255], text: [15, 110, 210] },    // 天藍
    sick_leave:        { bg: [255, 238, 215], text: [220, 120, 0] },     // 亮橘
    personal_leave:    { bg: [242, 228, 255], text: [130, 40, 200] },    // 亮紫
    menstrual_leave:   { bg: [255, 228, 242], text: [210, 40, 120] },    // 亮粉
    family_care_leave: { bg: [222, 250, 228], text: [25, 155, 55] },     // 亮綠
    official_leave:    { bg: [220, 240, 255], text: [25, 100, 200] },    // 湛藍
    marriage_leave:    { bg: [255, 228, 228], text: [200, 45, 45] },     // 玫紅
    bereavement_leave: { bg: [228, 235, 245], text: [55, 75, 110] },     // 灰藍
    maternity_leave:   { bg: [255, 250, 222], text: [200, 155, 10] },    // 亮黃
    prenatal_leave:    { bg: [255, 248, 220], text: [190, 145, 10] },    // 暖黃
    company_off:       { bg: [220, 228, 235], text: [80, 100, 120] },    // 灰藍（公休）
    late_early:        { bg: [255, 232, 222], text: [210, 80, 25] },     // 亮橘紅
  }
  const defaultLeaveColor = { bg: [235, 240, 250] as [number, number, number], text: [70, 90, 150] as [number, number, number] }

  // ── Build cell data including leaves ──
  interface CalendarEntry {
    staffName: string
    staffId: string
    render: CellRender
  }
  interface LeaveEntry {
    staffName: string
    staffId: string
    leaveName: string
    leaveColor: [number, number, number]
    leaveTextColor: [number, number, number]
  }
  interface CalendarCellData {
    date: string
    dayNum: number
    afternoon: CalendarEntry[]
    evening: CalendarEntry[]
    leaves: LeaveEntry[]
    isCompanyOff: boolean
  }
  const cellDataMap: Record<string, CalendarCellData> = {}

  weeks.forEach((week, rowIdx) => {
    week.forEach((date, colIdx) => {
      if (!date) return
      const daySchedules = dateSchedules[date] || []
      const afternoon: CalendarEntry[] = []
      const evening: CalendarEntry[] = []
      const leaves: LeaveEntry[] = []
      daySchedules.forEach((sch) => {
        const at = sch.attendance_type || 'work'
        const member = staffMap[sch.staff_id]
        if (!member) return

        if (at !== 'work') {
          // Leave/rest entry — use bright PDF colors
          const leaveType = getAttendanceType(at)
          if (!leaveType) return
          const pdfColor = LEAVE_PDF_COLORS[at] || defaultLeaveColor
          leaves.push({
            staffName: member.name,
            staffId: sch.staff_id,
            leaveName: leaveType.name,
            leaveColor: pdfColor.bg,
            leaveTextColor: pdfColor.text,
          })
          return
        }

        const render = buildCellRender(sch, shiftMap)
        if (!render) return
        const entry: CalendarEntry = { staffName: member.name, staffId: sch.staff_id, render }
        if (isAfternoon(sch)) afternoon.push(entry)
        else evening.push(entry)
      })
      sortByStaffOrder(afternoon)
      sortByStaffOrder(evening)
      leaves.sort((a, b) => (staffOrderMap[a.staffId] ?? 999) - (staffOrderMap[b.staffId] ?? 999))

      // 全員公休：所有 schedule 都是 company_off，無任何工作班次
      const allCompanyOff = daySchedules.length > 0
        && afternoon.length === 0
        && evening.length === 0
        && daySchedules.every((s) => (s.attendance_type || 'work') === 'company_off')

      cellDataMap[`${rowIdx}_${colIdx}`] = {
        date,
        dayNum: new Date(date + 'T00:00:00').getDate(),
        afternoon,
        evening,
        leaves: allCompanyOff ? [] : leaves, // 公休日不逐人列出
        isCompanyOff: allCompanyOff,
      }
    })
  })

  // ── Adaptive sizing — MUST fit 1 page ──
  const tableStartY = separatorY + 1.5
  const headerRowH = 5.5
  const safetyBuffer = 1.5 // prevent autoTable rounding overflow
  const availableH = pageH - tableStartY - margin - safetyBuffer
  const rowH = (availableH - headerRowH) / weeks.length

  // Adaptive font sizes — larger for readability
  const badgeFontSize = Math.min(12, Math.max(7, rowH * 0.3))
  const dayNumFontSize = badgeFontSize + 1.5
  const sectionLabelFontSize = Math.max(4.5, badgeFontSize - 2.5)
  const entryH = Math.min(5.5, Math.max(3.8, badgeFontSize * 0.5))

  // Build dummy body for autoTable (content drawn in didDrawCell)
  const head = [weekdayLabels]
  const body = weeks.map((week) =>
    week.map((date) => date ? String(new Date(date + 'T00:00:00').getDate()) : '')
  )

  autoTable(doc, {
    startY: tableStartY,
    head,
    body,
    styles: {
      font: fontName,
      fontSize: 5,
      cellPadding: 0.5,
      halign: 'left',
      valign: 'top',
      lineWidth: 0.15,
      lineColor: [200, 195, 185],
      minCellHeight: rowH,
      overflow: 'hidden',
    },
    headStyles: {
      fillColor: [90, 70, 50],
      textColor: 255,
      fontStyle: 'normal',
      font: fontName,
      halign: 'center',
      cellPadding: 1,
      fontSize: 7,
      minCellHeight: headerRowH,
    },
    margin: { left: marginLR, right: marginLR, top: 0, bottom: margin },

    willDrawCell: (hookData) => {
      // Clear head text (we draw bold manually)
      if (hookData.section === 'head') {
        hookData.cell.text = []
      }
      if (hookData.section !== 'body') return
      // Clear all body text
      hookData.cell.text = []
    },

    didDrawCell: (hookData) => {
      // ── Bold table header ──
      if (hookData.section === 'head') {
        const cell = hookData.cell
        const colIdx = hookData.column.index
        const label = weekdayLabels[colIdx] || ''
        const isWeekend = colIdx >= 5

        // Weekend header: slightly lighter brown
        if (isWeekend) {
          doc.setFillColor(120, 95, 70)
          doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
          doc.setDrawColor(200, 195, 185)
          doc.setLineWidth(0.15)
          doc.rect(cell.x, cell.y, cell.width, cell.height, 'S')
        }

        doc.setFont(fontName, 'normal')
        doc.setFontSize(7)
        calSetBold(doc, [255, 255, 255], 0.4)
        doc.text(label, cell.x + cell.width / 2, cell.y + cell.height / 2, {
          align: 'center',
          baseline: 'middle',
        })
        calEndBold(doc)
        return
      }

      if (hookData.section !== 'body') return

      const rowIdx = hookData.row.index
      const colIdx = hookData.column.index
      const date = weeks[rowIdx]?.[colIdx]
      const cell = hookData.cell
      const isWeekend = colIdx >= 5

      if (!date) {
        // Gray out empty cells
        doc.setFillColor(240, 238, 235)
        doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
        doc.setDrawColor(200, 195, 185)
        doc.setLineWidth(0.15)
        doc.rect(cell.x, cell.y, cell.width, cell.height, 'S')
        return
      }

      // Weekend background
      if (isWeekend) {
        doc.setFillColor(252, 250, 248)
        doc.rect(cell.x, cell.y, cell.width, cell.height, 'F')
        doc.setDrawColor(200, 195, 185)
        doc.setLineWidth(0.15)
        doc.rect(cell.x, cell.y, cell.width, cell.height, 'S')
      }

      const key = `${rowIdx}_${colIdx}`
      const data = cellDataMap[key]
      if (!data) return

      const cx = cell.x + 0.8
      const cw = cell.width
      let cy = cell.y + 0.5

      // Day number (bold)
      doc.setFont(fontName, 'normal')
      doc.setFontSize(dayNumFontSize)
      calSetBold(doc, [60, 46, 38], 0.35)
      doc.text(String(data.dayNum), cx, cy + dayNumFontSize * 0.35)
      calEndBold(doc)
      cy += dayNumFontSize * 0.42 + 0.5

      // 公休日：格子中央顯示「公休」文字，不渲染逐人假別
      if (data.isCompanyOff) {
        const companyOffColor = LEAVE_PDF_COLORS['company_off'] || defaultLeaveColor
        const contentBottom = cell.y + cell.height
        const centerY = (cy + contentBottom) / 2
        doc.setFont(fontName, 'normal')
        doc.setFontSize(badgeFontSize + 1)
        calSetBold(doc, companyOffColor.text, 0.3)
        doc.text('\u516C\u4F11', cell.x + cw / 2, centerY, { align: 'center' })
        calEndBold(doc)
        return
      }

      const sectionLabelW = 3.5
      const badgeR = 0.8

      // Calculate section areas
      // Total area for content: from cy to cell bottom - 0.5
      const contentBottom = cell.y + cell.height - 0.5
      const hasAfternoon = data.afternoon.length > 0
      const hasEvening = data.evening.length > 0
      const hasLeaves = data.leaves.length > 0

      // Divide available space: afternoon | evening | leaves
      const totalContentH = contentBottom - cy
      let afternoonEndY: number
      let eveningEndY: number

      if (hasLeaves) {
        // Reserve space for leaves at bottom
        const leaveH = Math.min(data.leaves.length * entryH, totalContentH * 0.25)
        eveningEndY = contentBottom - leaveH - 0.5
      } else {
        eveningEndY = contentBottom
      }

      // Dynamic split: proportional to entry count, or full space if one section is empty
      const workAreaH = eveningEndY - cy
      if (!hasEvening) {
        afternoonEndY = eveningEndY
      } else if (!hasAfternoon) {
        afternoonEndY = cy
      } else {
        const total = data.afternoon.length + data.evening.length
        const ratio = data.afternoon.length / total
        afternoonEndY = cy + workAreaH * Math.max(0.3, Math.min(0.7, ratio))
      }

      // Helper: render work entries in a section
      const badgePadH = 1.4 // horizontal padding inside badge
      const maxBadgeW = cw - 1.6 - sectionLabelW // max badge width (cell limit)

      const renderWorkEntries = (entries: CalendarEntry[], startY: number, endY: number, label: string) => {
        // Section label
        doc.setFont(fontName, 'normal')
        doc.setFontSize(sectionLabelFontSize)
        doc.setTextColor(170, 160, 150)
        doc.text(label, cx, startY + sectionLabelFontSize * 0.35)

        const maxEntries = Math.max(1, Math.floor((endY - startY) / entryH))
        let ey = startY
        entries.slice(0, maxEntries).forEach((entry) => {
          const staffColor = staffColorMap[entry.staffId]
          const badgeBg = staffColor?.bg || [107, 93, 85] as [number, number, number]
          const badgeTextColor = staffColor?.text || [255, 255, 255] as [number, number, number]

          const bx = cx + sectionLabelW

          // Build text first to measure
          doc.setFont(fontName, 'normal')
          doc.setFontSize(badgeFontSize)

          const r = entry.render
          let text = entry.staffName
          if (r.shiftName) text += ` ${r.shiftName}`
          else if (r.timeRange) text += ` ${r.timeRange}`

          // Truncate if exceeds max cell width
          while (doc.getTextWidth(text) > maxBadgeW - badgePadH * 2 && text.length > 3) {
            text = text.slice(0, -2) + '\u2026'
          }

          // Badge width = text width + padding, capped at cell width
          const textW = doc.getTextWidth(text)
          const bw = Math.min(textW + badgePadH * 2, maxBadgeW)

          doc.setFillColor(...badgeBg)
          doc.roundedRect(bx, ey - 0.3, bw, entryH - 0.2, badgeR, badgeR, 'F')

          calSetBold(doc, badgeTextColor, 0.25)
          doc.text(text, bx + badgePadH, ey + entryH * 0.52)
          calEndBold(doc)

          // Render tag pills right after the badge
          if (r.tags.length > 0) {
            const calTagFontSize = Math.max(badgeFontSize - 2, 4.5)
            const tagPillPad = 0.8
            const tagPillH2 = entryH - 0.8
            doc.setFont(fontName, 'normal')
            doc.setFontSize(calTagFontSize)
            let tagX = bx + bw + 0.5
            const tagMaxX = cx + cw - 1
            r.tags.forEach((tag) => {
              const tw = doc.getTextWidth(tag.name) + tagPillPad * 2
              if (tagX + tw > tagMaxX) return // don't overflow cell
              doc.setFillColor(...tag.bg)
              doc.roundedRect(tagX, ey - 0.1, tw, tagPillH2, 0.6, 0.6, 'F')
              doc.setTextColor(...tag.text)
              doc.text(tag.name, tagX + tw / 2, ey + entryH * 0.45, { align: 'center' })
              tagX += tw + 0.4
            })
          }

          ey += entryH
        })

        if (entries.length > maxEntries) {
          doc.setFont(fontName, 'normal')
          doc.setFontSize(sectionLabelFontSize)
          doc.setTextColor(140, 130, 120)
          doc.text(`+${entries.length - maxEntries}`, cx + sectionLabelW + 0.5, ey + entryH * 0.4)
        }
      }

      // Afternoon section
      if (hasAfternoon || hasEvening) {
        renderWorkEntries(data.afternoon, cy, afternoonEndY - 0.3, '\u5348')

        // Divider line
        doc.setDrawColor(200, 195, 185)
        doc.setLineWidth(0.1)
        doc.line(cell.x + 0.8, afternoonEndY, cell.x + cw - 0.8, afternoonEndY)

        // Evening section
        renderWorkEntries(data.evening, afternoonEndY + 0.5, eveningEndY, '\u665A')
      }

      // Leave entries — distinct style: colored dot + text + dashed underline
      if (hasLeaves) {
        const maxLeaveW = cw - 2
        const leaveFontSize = Math.max(badgeFontSize - 1.5, 5.5)
        const leaveEntryH = entryH * 0.9
        let leaveY = eveningEndY + (hasAfternoon || hasEvening ? 0.8 : 0)
        data.leaves.forEach((leave) => {
          if (leaveY + leaveEntryH > contentBottom + 0.5) return

          const bx = cx + 0.5
          const dotR = 1.2

          // Colored dot
          doc.setFillColor(...leave.leaveColor)
          doc.circle(bx + dotR, leaveY + leaveEntryH * 0.35, dotR, 'F')
          doc.setDrawColor(...leave.leaveTextColor)
          doc.setLineWidth(0.2)
          doc.circle(bx + dotR, leaveY + leaveEntryH * 0.35, dotR, 'S')

          // Text: "人名 假別"
          doc.setFont(fontName, 'normal')
          doc.setFontSize(leaveFontSize)

          let text = `${leave.staffName} ${leave.leaveName}`
          const textStartX = bx + dotR * 2 + 1.2
          while (doc.getTextWidth(text) > maxLeaveW - dotR * 2 - 2 && text.length > 3) {
            text = text.slice(0, -2) + '\u2026'
          }

          calSetBold(doc, leave.leaveTextColor, 0.2)
          doc.text(text, textStartX, leaveY + leaveEntryH * 0.55)
          calEndBold(doc)

          // Dashed underline
          const textW = doc.getTextWidth(text)
          doc.setDrawColor(...leave.leaveTextColor)
          doc.setLineWidth(0.15)
          const dashLen = 0.8
          const gapLen = 0.6
          const lineY = leaveY + leaveEntryH * 0.72
          let dx = textStartX
          const lineEnd = textStartX + textW
          while (dx < lineEnd) {
            const segEnd = Math.min(dx + dashLen, lineEnd)
            doc.line(dx, lineY, segEnd, lineY)
            dx = segEnd + gapLen
          }

          leaveY += leaveEntryH
        })
      }
    },
  })

  // Page numbers (minimal)
  const totalPages = doc.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setFontSize(6)
    doc.setTextColor(180, 180, 180)
    doc.text(
      `${i} / ${totalPages}`,
      pageW / 2,
      pageH - 2,
      { align: 'center' },
    )
  }

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}
