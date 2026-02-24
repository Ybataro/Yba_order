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
  weekDates: string[]
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
  const h = hex.replace('#', '')
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ]
}

function isLightColor(r: number, g: number, b: number): boolean {
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.6
}

// ── Per-cell render data ──
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

  // ── Leave ──
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

  // ── Work ──
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

  // ── Build cell render data ──
  const renderMap: Record<string, CellRender> = {}
  staff.forEach((member, rowIdx) => {
    weekDates.forEach((date, colIdx) => {
      const sch = scheduleMap[`${member.id}_${date}`]
      const render = buildCellRender(sch, shiftMap)
      if (render) {
        renderMap[`${rowIdx}_${colIdx + 1}`] = render
      }
    })
  })

  // ── Brand header ──
  doc.setFontSize(16)
  doc.setFont(fontName, 'normal')
  doc.setTextColor(139, 115, 85)
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

  // ── Body: placeholder text for row height calculation ──
  const body = staff.map((member, rowIdx) => [
    member.name,
    ...weekDates.map((_date, colIdx) => {
      const key = `${rowIdx}_${colIdx + 1}`
      const r = renderMap[key]
      if (!r) return '-'
      // Placeholder lines so autotable calculates enough row height
      const lines: string[] = []
      if (r.shiftName) lines.push(r.shiftName)
      if (r.timeRange) lines.push(r.timeRange)
      if (r.tags.length > 0) lines.push(r.tags.map((t) => t.name).join(' '))
      return lines.join('\n') || '-'
    }),
  ])

  // ── Render table ──
  autoTable(doc, {
    startY: 34,
    head: [head],
    body,
    styles: {
      font: fontName,
      fontSize: 7.5,
      cellPadding: 2.5,
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.15,
      lineColor: [230, 225, 220],
      minCellHeight: 14,
    },
    headStyles: {
      fillColor: [139, 115, 85],
      textColor: 255,
      fontStyle: 'normal',
      font: fontName,
      halign: 'center',
      cellPadding: 2.5,
      fontSize: 7.5,
    },
    columnStyles: {
      0: { halign: 'left', cellWidth: 22 },
    },
    alternateRowStyles: {
      fillColor: [252, 250, 248],
    },
    margin: { left: 14, right: 14 },

    willDrawCell: (hookData) => {
      if (hookData.section !== 'body') return
      const key = `${hookData.row.index}_${hookData.column.index}`
      if (renderMap[key]) {
        // Suppress autotable's own text — we draw it custom in didDrawCell
        hookData.cell.text = []
      }
    },

    didDrawCell: (hookData) => {
      if (hookData.section !== 'body') return

      // Staff name column (col 0): draw with proper color
      if (hookData.column.index === 0) {
        // already handled by autotable
        return
      }

      const key = `${hookData.row.index}_${hookData.column.index}`
      const r = renderMap[key]
      if (!r) return // '-' already drawn by autotable

      const cell = hookData.cell
      const cx = cell.x
      const cy = cell.y
      const cw = cell.width
      const ch = cell.height
      const pad = 1.5
      const radius = 2

      // ── Draw rounded badge ──
      const badgeX = cx + pad
      const badgeY = cy + pad
      const badgeW = cw - pad * 2
      const badgeH = ch - pad * 2

      if (r.badgeFill) {
        doc.setFillColor(...r.badgeFill)
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, radius, radius, 'F')
      }

      // ── Draw text lines ──
      doc.setFont(fontName, 'normal')
      const centerX = cx + cw / 2
      const hasTags = r.tags.length > 0
      const lineCount = (r.shiftName ? 1 : 0) + (r.timeRange ? 1 : 0)
      const tagHeight = hasTags ? 4.5 : 0
      const textBlockHeight = lineCount * 3.8 + tagHeight
      let textY = cy + (ch - textBlockHeight) / 2 + 3

      // Shift name
      if (r.shiftName) {
        doc.setFontSize(8)
        doc.setTextColor(...r.badgeText)
        doc.text(r.shiftName, centerX, textY, { align: 'center' })
        textY += 3.8
      }

      // Time range
      if (r.timeRange) {
        doc.setFontSize(6.5)
        // Slightly transparent for time
        const timeColor: [number, number, number] = r.badgeFill
          ? r.badgeText
          : [120, 110, 100]
        doc.setTextColor(...timeColor)
        doc.text(r.timeRange, centerX, textY, { align: 'center' })
        textY += 3.8
      }

      // ── Draw tag pills ──
      if (hasTags) {
        doc.setFontSize(5.5)
        const tagPillH = 3.2
        const tagGap = 1
        // Measure total width of all tags
        let totalTagW = 0
        const tagWidths: number[] = []
        r.tags.forEach((tag) => {
          const tw = doc.getTextWidth(tag.name) + 2.5
          tagWidths.push(tw)
          totalTagW += tw
        })
        totalTagW += (r.tags.length - 1) * tagGap

        let tagX = centerX - totalTagW / 2
        const tagY = textY

        r.tags.forEach((tag, i) => {
          const tw = tagWidths[i]
          // Tag pill background
          doc.setFillColor(...tag.bg)
          doc.roundedRect(tagX, tagY - 2.4, tw, tagPillH, 1, 1, 'F')
          // Tag text
          doc.setTextColor(...tag.text)
          doc.text(tag.name, tagX + tw / 2, tagY, { align: 'center' })
          tagX += tw + tagGap
        })
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
