// 排班系統型別與工具函式

export interface ShiftType {
  id: string
  name: string
  start_time: string
  end_time: string
  color: string
  group_id: string
  sort_order: number
  is_active: boolean
}

export interface Schedule {
  id: string
  staff_id: string
  date: string
  shift_type_id: string | null
  custom_start: string | null
  custom_end: string | null
  note: string
  created_by: string | null
}

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/** 將 Date 物件格式化為 YYYY-MM-DD（本地時間，避免 toISOString 的 UTC 偏移） */
export function toLocalDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** 取得指定日期所在週的週一～週日日期陣列 */
export function getWeekDates(refDate: string): string[] {
  const d = new Date(refDate + 'T00:00:00')
  const day = d.getDay() // 0=日 ~ 6=六
  const monday = new Date(d)
  monday.setDate(d.getDate() - ((day + 6) % 7)) // 回推到週一

  const dates: string[] = []
  for (let i = 0; i < 7; i++) {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    dates.push(toLocalDateString(cur))
  }
  return dates
}

/** 格式化日期為 M/D */
export function formatShortDate(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return `${d.getMonth() + 1}/${d.getDate()}`
}

/** 取得星期幾（一、二、三...） */
export function getWeekdayLabel(date: string): string {
  const d = new Date(date + 'T00:00:00')
  return WEEKDAYS[d.getDay()]
}

/** 計算工時（小時），支援跨日（end < start 時自動 +24h） */
export function calcHours(start: string, end: string): number {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  let startMin = sh * 60 + sm
  let endMin = eh * 60 + em
  if (endMin <= startMin) endMin += 24 * 60 // 跨日
  return (endMin - startMin) / 60
}

/** 取得指定月份的所有日期 */
export function getMonthDates(year: number, month: number): string[] {
  const dates: string[] = []
  const daysInMonth = new Date(year, month, 0).getDate() // month 是 1-based
  for (let i = 1; i <= daysInMonth; i++) {
    const d = `${year}-${String(month).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    dates.push(d)
  }
  return dates
}

/** 格式化時間 (HH:MM → H:MM) */
export function formatTime(time: string): string {
  if (!time) return ''
  const [h, m] = time.split(':')
  return `${parseInt(h)}:${m}`
}
