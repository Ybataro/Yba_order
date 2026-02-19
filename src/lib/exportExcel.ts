import * as XLSX from 'xlsx'

interface ExportOptions {
  data: Record<string, unknown>[]
  fileName: string
  sheetName?: string
}

/**
 * Export data array to an Excel (.xlsx) file and trigger download.
 */
export function exportToExcel({ data, fileName, sheetName = 'Sheet1' }: ExportOptions) {
  const ws = XLSX.utils.json_to_sheet(data)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, sheetName)
  XLSX.writeFile(wb, fileName.endsWith('.xlsx') ? fileName : `${fileName}.xlsx`)
}
