// 排班系統型別與工具函式

// ── 出勤類型常數 ────────────────────────────────────
export interface AttendanceTypeDef {
  id: string
  name: string
  color: string        // 背景色
  textColor: string    // 文字色
  category: 'work' | 'leave' | 'special'
  countsAsWork: boolean
}

export const ATTENDANCE_TYPES: AttendanceTypeDef[] = [
  { id: 'work',              name: '上班',       color: '#E8F5E9', textColor: '#2E7D32', category: 'work',    countsAsWork: true  },
  { id: 'rest_day',          name: '休息日',     color: '#E0E0E0', textColor: '#666',    category: 'leave',   countsAsWork: false },
  { id: 'regular_leave',     name: '例假日',     color: '#BDBDBD', textColor: '#555',    category: 'leave',   countsAsWork: false },
  { id: 'national_holiday',  name: '國定假日',   color: '#FFCDD2', textColor: '#C62828', category: 'leave',   countsAsWork: false },
  { id: 'annual_leave',      name: '特休',       color: '#B3E5FC', textColor: '#0277BD', category: 'leave',   countsAsWork: false },
  { id: 'sick_leave',        name: '病假',       color: '#FFE0B2', textColor: '#E65100', category: 'leave',   countsAsWork: false },
  { id: 'personal_leave',    name: '事假',       color: '#E1BEE7', textColor: '#6A1B9A', category: 'leave',   countsAsWork: false },
  { id: 'menstrual_leave',   name: '生理假',     color: '#F8BBD0', textColor: '#AD1457', category: 'leave',   countsAsWork: false },
  { id: 'family_care_leave', name: '家庭照顧假', color: '#C8E6C9', textColor: '#2E7D32', category: 'leave',   countsAsWork: false },
  { id: 'official_leave',    name: '公假',       color: '#BBDEFB', textColor: '#1565C0', category: 'leave',   countsAsWork: false },
  { id: 'marriage_leave',    name: '婚假',       color: '#FFCDD2', textColor: '#C62828', category: 'leave',   countsAsWork: false },
  { id: 'bereavement_leave', name: '喪假',       color: '#CFD8DC', textColor: '#37474F', category: 'leave',   countsAsWork: false },
  { id: 'maternity_leave',   name: '產假',       color: '#FFF9C4', textColor: '#F57F17', category: 'leave',   countsAsWork: false },
  { id: 'prenatal_leave',    name: '產檢假',     color: '#FFF9C4', textColor: '#F57F17', category: 'leave',   countsAsWork: false },
  { id: 'late_early',        name: '遲到早退',   color: '#FFCCBC', textColor: '#BF360C', category: 'special', countsAsWork: true  },
]

export function getAttendanceType(id: string): AttendanceTypeDef | undefined {
  return ATTENDANCE_TYPES.find((t) => t.id === id)
}

// ── 標籤顏色（自動分配） ─────────────────────────────
const TAG_COLORS = [
  { bg: '#E3F2FD', text: '#1565C0' },  // 藍
  { bg: '#FFF3E0', text: '#E65100' },  // 橘
  { bg: '#E8F5E9', text: '#2E7D32' },  // 綠
  { bg: '#FCE4EC', text: '#AD1457' },  // 粉
  { bg: '#F3E5F5', text: '#6A1B9A' },  // 紫
  { bg: '#E0F7FA', text: '#00695C' },  // 青
  { bg: '#FFF8E1', text: '#F57F17' },  // 琥珀
  { bg: '#EFEBE9', text: '#4E342E' },  // 棕
]

export function getTagColor(name: string): { bg: string; text: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

// ── 職位 ────────────────────────────────────────────
export interface Position {
  id: string
  name: string
  color: string
  group_id: string
  sort_order: number
  is_active: boolean
}

// ── 班次類型 ────────────────────────────────────────
export interface ShiftType {
  id: string
  name: string
  start_time: string
  end_time: string
  color: string
  group_id: string
  sort_order: number
  is_active: boolean
  tags: string[]
}

// ── 排班記錄 ────────────────────────────────────────
export interface Schedule {
  id: string
  staff_id: string
  date: string
  shift_type_id: string | null
  custom_start: string | null
  custom_end: string | null
  note: string
  created_by: string | null
  position_id: string | null
  attendance_type: string  // 預設 'work'
  tags: string[]           // 排班獨立標籤
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
