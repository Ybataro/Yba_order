import { useState, useRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowLeft, Printer, ExternalLink } from 'lucide-react'
import { useStoreStore } from '@/stores/useStoreStore'
import { useZoneStore } from '@/stores/useZoneStore'

interface QRItem {
  title: string
  path: string
}

export default function QRCodePage() {
  const stores = useStoreStore((s) => s.items)
  const getStoreZones = useZoneStore((s) => s.getStoreZones)
  const [baseUrl, setBaseUrl] = useState(window.location.origin)
  const printRef = useRef<HTMLDivElement>(null)

  const qrItems: QRItem[] = [
    ...stores.flatMap((store) => {
      const zones = getStoreZones(store.id)
      if (zones.length <= 1) {
        return [{ title: store.name, path: `/store/${store.id}` }]
      }
      return zones.map((zone) => ({
        title: `${store.name} ${zone.zoneName}`,
        path: `/store/${store.id}?zone=${zone.zoneCode}`,
      }))
    }),
    { title: '央廚', path: '/kitchen' },
    { title: '後台管理', path: '/admin' },
  ]

  const getFullUrl = (path: string) => `${baseUrl}${path}`

  const handlePrint = () => {
    const printWindow = window.open('', '_blank')
    if (!printWindow) return

    const cards = qrItems
      .map(
        (item) => `
      <div style="display:inline-flex;flex-direction:column;align-items:center;padding:24px;border:1px solid #ddd;border-radius:12px;width:240px;margin:12px;">
        <h3 style="margin:0 0 12px;font-size:18px;color:#5D4037;">${item.title}</h3>
        <div id="qr-${item.path.replace(/[?=&]/g, '_')}"></div>
        <p style="margin:8px 0 0;font-size:11px;color:#888;word-break:break-all;text-align:center;max-width:200px;">${getFullUrl(item.path)}</p>
      </div>
    `
      )
      .join('')

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>QR Codes - 阿爸的芋圓</title>
        <style>
          @page { margin: 20mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; }
          h1 { color: #5D4037; margin-bottom: 24px; }
          .grid { display: flex; flex-wrap: wrap; justify-content: center; }
        </style>
      </head>
      <body>
        <h1>阿爸的芋圓 - QR Codes</h1>
        <div class="grid">${cards}</div>
        <script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"><\/script>
        <script>
          ${qrItems
            .map(
              (item) => `
            new QRCode(document.getElementById('qr-${item.path.replace(/[?=&]/g, '_')}'), {
              text: '${getFullUrl(item.path)}',
              width: 180,
              height: 180,
              correctLevel: QRCode.CorrectLevel.M,
            });
          `
            )
            .join('')}
          setTimeout(() => window.print(), 500);
        <\/script>
      </body>
      </html>
    `)
    printWindow.document.close()
  }

  return (
    <div className="page-container">
      {/* Header */}
      <div className="bg-brand-oak text-white px-4 pt-12 pb-6">
        <button onClick={() => { window.location.href = '/admin' }} className="flex items-center gap-1 text-sm opacity-80 mb-3">
          <ArrowLeft size={16} />
          返回後台
        </button>
        <h1 className="text-xl font-bold">QR Code 管理</h1>
        <p className="text-sm opacity-80 mt-1">掃碼直接進入各門店首頁</p>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Base URL input */}
        <div>
          <label className="text-sm font-medium text-brand-oak block mb-1">網址前綴 (BASE URL)</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value.replace(/\/$/, ''))}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-oak/30"
            placeholder="https://your-site.netlify.app"
          />
          <p className="text-xs text-brand-lotus mt-1">部署後請填入 Netlify 網址</p>
        </div>

        {/* Print button */}
        <button onClick={handlePrint} className="btn-primary w-full flex items-center justify-center gap-2">
          <Printer size={18} />
          列印全部 QR Code（A4）
        </button>

        {/* QR Code cards */}
        <div ref={printRef} className="space-y-4">
          {qrItems.map((item) => (
            <div key={item.path} className="card flex flex-col items-center py-6">
              <h3 className="text-lg font-semibold text-brand-oak mb-3">{item.title}</h3>
              <QRCodeSVG value={getFullUrl(item.path)} size={200} level="M" />
              <a
                href={getFullUrl(item.path)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 text-sm text-blue-600 flex items-center gap-1 hover:underline break-all text-center"
              >
                {getFullUrl(item.path)}
                <ExternalLink size={14} />
              </a>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
