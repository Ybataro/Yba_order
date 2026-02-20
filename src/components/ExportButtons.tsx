import { Download, FileText } from 'lucide-react'

interface ExportButtonsProps {
  onExportExcel: () => void
  onExportPdf: () => void
}

export default function ExportButtons({ onExportExcel, onExportPdf }: ExportButtonsProps) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onExportExcel}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-mocha text-white text-xs font-medium active:scale-95 transition-transform"
        title="匯出 Excel"
      >
        <Download size={14} />
        Excel
      </button>
      <button
        onClick={onExportPdf}
        className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-lotus text-white text-xs font-medium active:scale-95 transition-transform"
        title="匯出 PDF"
      >
        <FileText size={14} />
        PDF
      </button>
    </div>
  )
}
