import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { loadNotoSansTC } from '@/assets/notoSansTC'
import {
  formatShortDate,
  getWeekdayLabel,
  formatTime,
  getAttendanceType,
} from '@/lib/schedule'
import type { ShiftType, Schedule } from '@/lib/schedule'
import type { StaffMember } from '@/data/staff'

export interface SchedulePdfOptions {
  title: string
  dateRange: string
  weekDates: string[]
  staff: StaffMember[]
  schedules: Schedule[]
  shiftTypes: ShiftType[]
  fileName: string
}

let fontRegistered = false

async function registerFont(doc: jsPDF): Promise<boolean> {
  if (fontRegistered) {
    doc.setFont('NotoSansTC')
    return true
  }

  const fontData = await loadNotoSansTC()
  if (!fontData) return false

  try {
    doc.addFileToVFS('NotoSansTC-Regular.ttf', fontData)
    doc.addFont('NotoSansTC-Regular.ttf', 'NotoSansTC', 'normal')
    doc.setFont('NotoSansTC')
    fontRegistered = true
    return true
  } catch (e) {
    console.warn('[exportSchedulePdf] Font registration failed:', e)
    return false
  }
}

/** Parse hex color string to [r, g, b] */
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

/** Determine if a color is light (needs dark text) or dark (needs light text) */
function isLightColor(r: number, g: number, b: number): boolean {
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6
}

interface CellColor {
  fill: [number, number, number]
  text: [number, number, number]
}

function getCellText(
  schedule: Schedule | undefined,
  shiftMap: Record<string, ShiftType>,
): string {
  if (!schedule) return '-'

  const at = schedule.attendance_type || 'work'
  if (at !== 'work') {
    const leave = getAttendanceType(at)
    return leave?.name ?? at
  }

  const lines: string[] = []

  if (schedule.shift_type_id && shiftMap[schedule.shift_type_id]) {
    const st = shiftMap[schedule.shift_type_id]
    lines.push(st.name)
    lines.push(`${formatTime(st.start_time)}-${formatTime(st.end_time)}`)
  } else if (schedule.custom_start && schedule.custom_end) {
    lines.push(`${formatTime(schedule.custom_start)}-${formatTime(schedule.custom_end)}`)
  }

  if (schedule.tags?.length) {
    lines.push(schedule.tags.join('、'))
  }

  return lines.length > 0 ? lines.join('\n') : '班'
}

function getCellColor(
  schedule: Schedule | undefined,
  shiftMap: Record<string, ShiftType>,
): CellColor | null {
  if (!schedule) return null

  const at = schedule.attendance_type || 'work'

  // Leave types
  if (at !== 'work') {
    const leave = getAttendanceType(at)
    if (leave) {
      const fill = hexToRgb(leave.color)
      const text = hexToRgb(leave.textColor)
      return { fill, text }
    }
    return { fill: [224, 224, 224], text: [100, 100, 100] }
  }

  // Shift types with color
  if (schedule.shift_type_id && shiftMap[schedule.shift_type_id]) {
    const st = shiftMap[schedule.shift_type_id]
    if (st.color) {
      const fill = hexToRgb(st.color)
      const text: [number, number, number] = isLightColor(...fill)
        ? [60, 46, 38] // dark brown text for light backgrounds
        : [255, 255, 255] // white text for dark backgrounds
      return { fill, text }
    }
  }

  // Tags only, no shift
  if (schedule.tags?.length && !schedule.shift_type_id) {
    return null // no special color, just text
  }

  return null
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
  doc.setFontSize(16)
  doc.setFont(fontName, 'normal')
  doc.setTextColor(139, 115, 85) // brand-mocha
  doc.text('\u963F\u7238\u7684\u828B\u5713', 14, 15) // 阿爸的芋圓

  doc.setFontSize(12)
  doc.setTextColor(60, 46, 38)
  doc.text(title, 14, 23)

  doc.setFontSize(9)
  doc.setTextColor(120, 120, 120)
  doc.text(dateRange, 14, 29)
  doc.setTextColor(0, 0, 0)

  // ── Table columns ──
  const head = [
    '員工',
    ...weekDates.map((d) => `${getWeekdayLabel(d)} ${formatShortDate(d)}`),
  ]

  // ── Table rows ──
  const body = staff.map((member) => [
    member.name,
    ...weekDates.map((date) => {
      const sch = scheduleMap[`${member.id}_${date}`]
      return getCellText(sch, shiftMap)
    }),
  ])

  // ── Build color map: "rowIdx_colIdx" -> CellColor ──
  const colorMap: Record<string, CellColor> = {}
  staff.forEach((member, rowIdx) => {
    weekDates.forEach((date, colIdx) => {
      const sch = scheduleMap[`${member.id}_${date}`]
      const color = getCellColor(sch, shiftMap)
      if (color) {
        colorMap[`${rowIdx}_${colIdx + 1}`] = color // +1 because col 0 is staff name
      }
    })
  })

  // ── Render table ──
  autoTable(doc, {
    startY: 34,
    head: [head],
    body,
    styles: {
      font: fontName,
      fontSize: 8,
      cellPadding: 3,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.2,
      lineColor: [220, 215, 210],
    },
    headStyles: {
      fillColor: [139, 115, 85], // brand-mocha
      textColor: 255,
      fontStyle: 'normal',
      font: fontName,
      halign: 'center',
      cellPadding: 3,
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 24 },
    },
    alternateRowStyles: {
      fillColor: [250, 248, 245],
    },
    margin: { left: 14, right: 14 },
    willDrawCell: (hookData) => {
      if (hookData.section === 'body') {
        const key = `${hookData.row.index}_${hookData.column.index}`
        const color = colorMap[key]
        if (color) {
          hookData.cell.styles.fillColor = color.fill
          hookData.cell.styles.textColor = color.text
        }
      }
    },
    didDrawPage: (hookData) => {
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

  doc.save(fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}
