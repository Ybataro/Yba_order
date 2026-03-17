export const NOTE_ITEMS = [
  { id: 'note_almond1000', dbField: 'almond_1000', stateKey: 'almond1000', label: '杏仁茶瓶 1000ml', unit: '個' },
  { id: 'note_almond300',  dbField: 'almond_300',  stateKey: 'almond300',  label: '杏仁茶瓶 300ml',  unit: '個' },
  { id: 'note_bowlK520',   dbField: 'bowl_k520',     stateKey: 'bowlK520',   label: 'K520 紙碗',       unit: '箱' },
  { id: 'note_bowl750',    dbField: 'bowl_750',       stateKey: 'bowl750',    label: '750 紙碗',        unit: '箱' },
  { id: 'note_bowl750Lid', dbField: 'bowl_750_lid',   stateKey: 'bowl750Lid', label: '750 蓋',          unit: '箱' },
] as const

export type NoteItem = typeof NOTE_ITEMS[number]

export const NOTE_ITEM_MAP = Object.fromEntries(
  NOTE_ITEMS.map(n => [n.id, n])
) as Record<string, NoteItem>
