import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadNotoSansTC } from '@/assets/notoSansTC'
import { savePdfCompat } from '@/lib/savePdf'
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

export async function exportScheduleToPdf({
  title: _title,
  dateRange: _dateRange,
  weekDates,
  staff,
  schedules,
  shiftTypes,
  fileName,
}: SchedulePdfOptions) {
  void _title; void _dateRange
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const pageW = doc.internal.pageSize.getWidth()   // 297
  const pageH = doc.internal.pageSize.getHeight()  // 210

  const hasCJK = await registerFont(doc)
  const fontName = hasCJK ? 'NotoSansTC' : 'helvetica'

  // Build lookup maps
  const shiftMap: Record<string, ShiftType> = {}
  shiftTypes.forEach((st) => { shiftMap[st.id] = st })
  const scheduleMap: Record<string, Schedule> = {}
  schedules.forEach((s) => { scheduleMap[`${s.staff_id}_${s.date}`] = s })

  // ── Extract year/month from first date ──
  const firstD = new Date(weekDates[0] + 'T00:00:00')
  const pdfYear = firstD.getFullYear()
  const pdfMonth = firstD.getMonth() + 1

  // ── Layout constants ──
  const marginLR = 5
  const marginTop = 3
  const tableGap = 2.5 // gap between upper and lower table

  // ── Header: "2026  3月" ──
  const headerY = marginTop + 5
  doc.setFont(fontName, 'normal')
  doc.setFontSize(18)
  calSetBold(doc, [60, 46, 38], 0.55)
  doc.text(`${pdfYear}  ${pdfMonth}\u6708`, marginLR, headerY)
  calEndBold(doc)

  const contentStartY = headerY + 3

  // ── Split dates into 2 halves: 1-15, 16-end ──
  const halfA = weekDates.filter((d) => {
    const day = new Date(d + 'T00:00:00').getDate()
    return day <= 15
  })
  const halfB = weekDates.filter((d) => {
    const day = new Date(d + 'T00:00:00').getDate()
    return day > 15
  })
  const halves = [halfA, halfB].filter((h) => h.length > 0)

  // ── Adaptive sizing — maximize font while fitting 1 A4 page ──
  const maxCols = Math.max(halfA.length, halfB.length, 1)
  const numStaff = Math.max(staff.length, 1)
  const availableH = pageH - contentStartY - 1 // bottom margin
  const perTableH = (availableH - tableGap) / 2

  // Row heights — strictly calculated to fit
  const headRowH = 9
  const dataRowH = (perTableH - headRowH) / numStaff

  // Font sizes — maximize to fill row height
  const shiftNameFS = Math.min(11, Math.max(6, dataRowH * 0.75))
  const timeFS = Math.min(9, Math.max(5, shiftNameFS * 0.8))
  const headWeekdayFS = Math.min(11, Math.max(7, headRowH * 0.7))
  const headDateFS = Math.min(9, Math.max(5.5, headWeekdayFS * 0.8))
  const staffNameFS = shiftNameFS
  const plusFS = Math.min(10, Math.max(6, dataRowH * 0.6))

  // Name column width
  const nameColW = 13

  // Date column width — auto-distribute remaining space
  const tableW = pageW - marginLR * 2
  const dateColW = (tableW - nameColW) / maxCols

  // Badge sizing — adaptive
  const badgePadV = Math.max(0.3, dataRowH * 0.05)
  const badgeR = 1.0
  const lineGap = Math.min(5, Math.max(2.8, dataRowH * 0.38))

  // ── Manual draw (no autoTable) to guarantee single-page fit ──
  const drawTable = (chunk: string[], tableStartY: number) => {
    const totalCols = chunk.length + 1 // +1 for name column
    const colWidths = [nameColW, ...chunk.map(() => dateColW)]

    // Build cell render data
    const renderMap: Record<string, CellRender> = {}
    staff.forEach((member, rowIdx) => {
      chunk.forEach((date, colIdx) => {
        const sch = scheduleMap[`${member.id}_${date}`]
        const render = buildCellRender(sch, shiftMap)
        if (render) renderMap[`${rowIdx}_${colIdx}`] = render
      })
    })

    const drawHLine = (y: number) => {
      doc.setDrawColor(225, 220, 215)
      doc.setLineWidth(0.15)
      doc.line(marginLR, y, marginLR + tableW, y)
    }

    const drawVLines = () => {
      const totalH = headRowH + numStaff * dataRowH
      doc.setDrawColor(225, 220, 215)
      doc.setLineWidth(0.15)
      let vx = marginLR
      for (let c = 0; c <= totalCols; c++) {
        doc.line(vx, tableStartY, vx, tableStartY + totalH)
        vx += c < totalCols ? colWidths[c] : 0
      }
    }

    // ── Draw header row background ──
    doc.setFillColor(250, 248, 245)
    doc.rect(marginLR, tableStartY, tableW, headRowH, 'F')

    // ── Draw header content ──
    let hx = marginLR
    // "員工" header
    doc.setFont(fontName, 'normal')
    doc.setFontSize(staffNameFS)
    calSetBold(doc, [139, 115, 85], 0.3)
    doc.text('\u54E1\u5DE5', hx + 1.5, tableStartY + headRowH / 2, { baseline: 'middle' })
    calEndBold(doc)
    hx += nameColW

    // Date headers
    chunk.forEach((d) => {
      const weekday = getWeekdayLabel(d)
      const dateStr = formatShortDate(d)

      doc.setFont(fontName, 'normal')
      doc.setFontSize(headWeekdayFS)
      calSetBold(doc, [100, 85, 70], 0.3)
      doc.text(weekday, hx + dateColW / 2, tableStartY + headRowH * 0.33, {
        align: 'center', baseline: 'middle',
      })
      calEndBold(doc)

      doc.setFontSize(headDateFS)
      calSetBold(doc, [140, 125, 110], 0.2)
      doc.text(dateStr, hx + dateColW / 2, tableStartY + headRowH * 0.72, {
        align: 'center', baseline: 'middle',
      })
      calEndBold(doc)

      hx += dateColW
    })

    drawHLine(tableStartY)
    drawHLine(tableStartY + headRowH)

    // ── Draw body rows ──
    staff.forEach((member, rowIdx) => {
      const ry = tableStartY + headRowH + rowIdx * dataRowH

      // Alternate row background
      if (rowIdx % 2 === 1) {
        doc.setFillColor(253, 251, 249)
        doc.rect(marginLR, ry, tableW, dataRowH, 'F')
      }

      let cx = marginLR

      // Staff name
      doc.setFont(fontName, 'normal')
      doc.setFontSize(staffNameFS)
      calSetBold(doc, [60, 46, 38], 0.2)
      doc.text(member.name, cx + 1.5, ry + dataRowH / 2, { baseline: 'middle' })
      calEndBold(doc)
      cx += nameColW

      // Date cells
      chunk.forEach((_date, colIdx) => {
        const r = renderMap[`${rowIdx}_${colIdx}`]
        const cellCx = cx + dateColW / 2

        if (!r) {
          // Empty cell — "+"
          doc.setFont(fontName, 'normal')
          doc.setFontSize(plusFS)
          doc.setTextColor(210, 205, 200)
          doc.text('+', cellCx, ry + dataRowH / 2, { align: 'center', baseline: 'middle' })
        } else {
          // Colored badge
          const bw = dateColW - 1.0
          const bh = dataRowH - badgePadV * 2
          const bx = cx + (dateColW - bw) / 2
          const by = ry + badgePadV

          if (r.badgeFill) {
            doc.setFillColor(...r.badgeFill)
            doc.roundedRect(bx, by, bw, bh, badgeR, badgeR, 'F')
          }

          // Text
          const lc = (r.shiftName ? 1 : 0) + (r.timeRange ? 1 : 0)
          const textBlockH = lc * lineGap
          let textY = ry + (dataRowH - textBlockH) / 2 + lineGap * 0.55

          if (r.shiftName) {
            doc.setFont(fontName, 'normal')
            doc.setFontSize(shiftNameFS)
            calSetBold(doc, r.badgeText, 0.25)
            doc.text(r.shiftName, cellCx, textY, { align: 'center' })
            calEndBold(doc)
            textY += lineGap
          }

          if (r.timeRange) {
            doc.setFont(fontName, 'normal')
            doc.setFontSize(timeFS)
            const tc: [number, number, number] = r.badgeFill ? r.badgeText : [120, 110, 100]
            doc.setTextColor(...tc)
            doc.text(r.timeRange, cellCx, textY, { align: 'center' })
          }
        }

        cx += dateColW
      })

      drawHLine(ry + dataRowH)
    })

    // Vertical lines
    drawVLines()
  }

  halves.forEach((chunk, halfIdx) => {
    const startY = contentStartY + halfIdx * (perTableH + tableGap)
    drawTable(chunk, startY)
  })

  // Page number
  doc.setFontSize(5.5)
  doc.setTextColor(180, 180, 180)
  doc.text('1 / 1', pageW / 2, pageH - 2, { align: 'center' })

  await savePdfCompat(doc, fileName)
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

  // Legend — right-aligned, same line as brand + title
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

  // Year/month — separate prominent line (2x font size)
  const ymY = headerY + 7
  doc.setFontSize(18)
  calSetBold(doc, [60, 46, 38], 0.5)
  doc.text(`${year}\u5E74${month}\u6708`, marginLR, ymY)
  calEndBold(doc)

  // Header separator line
  const separatorY = ymY + 3
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
    comp_leave:        { bg: [210, 245, 250], text: [0, 131, 143] },     // 青綠（補休）
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

  // ── Adaptive sizing — MUST fit 1 page (95% table scale) ──
  const tableMarginLR = marginLR + (pageW - 2 * marginLR) * 0.025
  const tableStartY = separatorY + 1.5
  const headerRowH = 5.5
  const safetyBuffer = 1.5 // prevent autoTable rounding overflow
  const availableH = (pageH - tableStartY - margin - safetyBuffer) * 0.95
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
    margin: { left: tableMarginLR, right: tableMarginLR, top: 0, bottom: margin },

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
        if (!hasAfternoon && !hasEvening) {
          // Pure leave day — leaves get all content space
          eveningEndY = cy
        } else {
          // Mixed day — give leaves proportional space (up to 40%)
          const leaveH = Math.min(data.leaves.length * entryH, totalContentH * 0.4)
          eveningEndY = contentBottom - leaveH - 0.5
        }
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

      // Helper: render work entries — name on top, 2-char tags below (matching web UI)
      const badgePadH = 1.4
      const personGap = 1.0
      const calTagFontSize = Math.max(badgeFontSize - 1, 5.5)
      const tagPillPad = 0.6
      const tagPillH = Math.max(3, entryH * 0.65)
      const tagRowGap = 0.3

      const renderWorkEntries = (entries: CalendarEntry[], startY: number, endY: number, label: string) => {
        // Section label
        doc.setFont(fontName, 'normal')
        doc.setFontSize(sectionLabelFontSize)
        doc.setTextColor(170, 160, 150)
        doc.text(label, cx, startY + sectionLabelFontSize * 0.35)

        const bx = cx + sectionLabelW
        const maxX = cx + cw - 1.5

        // Row height: name badge + tag row (if any entry has tags)
        const anyTags = entries.some(e => e.render.tags.length > 0)
        const personRowH = anyTags ? entryH + tagPillH + tagRowGap : entryH
        const maxRows = Math.max(1, Math.floor((endY - startY) / personRowH))

        // Pre-compute each person's column width
        interface PersonLayout {
          entry: CalendarEntry
          shortName: string
          nameBadgeW: number
          shortTags: { name: string; bg: [number, number, number]; text: [number, number, number]; width: number }[]
          columnW: number
        }
        const layouts: PersonLayout[] = entries.map((entry) => {
          const shortName = entry.staffName.slice(0, 2)
          doc.setFont(fontName, 'normal')
          doc.setFontSize(badgeFontSize)
          const nameBadgeW = doc.getTextWidth(shortName) + badgePadH * 2

          doc.setFontSize(calTagFontSize)
          let tagsRowW = 0
          const shortTags = entry.render.tags.map((tag) => {
            const sn = tag.name.slice(0, 2)
            const tw = doc.getTextWidth(sn) + tagPillPad * 2
            tagsRowW += tw + 0.3
            return { name: sn, bg: tag.bg, text: tag.text, width: tw }
          })
          if (shortTags.length > 0) tagsRowW -= 0.3

          return { entry, shortName, nameBadgeW, shortTags, columnW: Math.max(nameBadgeW, tagsRowW) }
        })

        let ey = startY
        let currentX = bx
        let rowCount = 0
        let renderedCount = 0

        for (const layout of layouts) {
          if (rowCount >= maxRows) break

          // Wrap to next row if doesn't fit
          if (currentX + layout.columnW > maxX && currentX > bx) {
            currentX = bx
            ey += personRowH
            rowCount++
            if (rowCount >= maxRows) break
          }

          const staffColor = staffColorMap[layout.entry.staffId]
          const badgeBg = staffColor?.bg || [107, 93, 85] as [number, number, number]
          const badgeTextColor = staffColor?.text || [255, 255, 255] as [number, number, number]

          // ── Name badge (top) ──
          doc.setFillColor(...badgeBg)
          doc.roundedRect(currentX, ey - 0.3, layout.nameBadgeW, entryH - 0.2, badgeR, badgeR, 'F')

          doc.setFont(fontName, 'normal')
          doc.setFontSize(badgeFontSize)
          calSetBold(doc, badgeTextColor, 0.25)
          doc.text(layout.shortName, currentX + badgePadH, ey + entryH * 0.52)
          calEndBold(doc)

          // ── Tag pills (below name) ──
          if (layout.shortTags.length > 0) {
            const tagY = ey + entryH - 0.2 + tagRowGap
            let tagX = currentX
            doc.setFont(fontName, 'normal')
            doc.setFontSize(calTagFontSize)
            for (const tag of layout.shortTags) {
              if (tagX + tag.width > maxX) break
              doc.setFillColor(...tag.bg)
              doc.roundedRect(tagX, tagY, tag.width, tagPillH, 0.6, 0.6, 'F')
              doc.setTextColor(...tag.text)
              doc.text(tag.name, tagX + tag.width / 2, tagY + tagPillH * 0.65, { align: 'center' })
              tagX += tag.width + 0.3
            }
          }

          currentX += layout.columnW + personGap
          renderedCount++
        }

        if (renderedCount < entries.length) {
          if (currentX > bx && currentX + 8 > maxX) {
            currentX = bx
            ey += personRowH
          }
          doc.setFont(fontName, 'normal')
          doc.setFontSize(sectionLabelFontSize)
          doc.setTextColor(140, 130, 120)
          doc.text(`+${entries.length - renderedCount}`, currentX > bx ? currentX + 0.5 : bx + 0.5, ey + entryH * 0.4)
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

          // Text: "名字 假別" (2-char short name)
          doc.setFont(fontName, 'normal')
          doc.setFontSize(leaveFontSize)

          let text = `${leave.staffName.slice(0, 2)} ${leave.leaveName}`
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

  await savePdfCompat(doc, fileName)
}
