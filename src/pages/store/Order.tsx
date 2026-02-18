import { useState, useMemo } from 'react'
import { useParams } from 'react-router-dom'
import { TopNav } from '@/components/TopNav'
import { NumericInput } from '@/components/NumericInput'
import { SectionHeader } from '@/components/SectionHeader'
import { BottomAction } from '@/components/BottomAction'
import { useToast } from '@/components/Toast'
import { useProductStore } from '@/stores/useProductStore'
import { useStoreStore } from '@/stores/useStoreStore'
import { Send, Lightbulb, Sun, CloudRain, Cloud, CloudSun, Thermometer, Droplets, TrendingUp, TrendingDown } from 'lucide-react'

// 模擬天氣資料（Phase 2 串接中央氣象署 API）
const mockWeather = {
  date: '明日',
  condition: 'sunny' as WeatherCondition, // sunny | cloudy | partly_cloudy | rainy
  conditionText: '晴天',
  tempHigh: 32,
  tempLow: 24,
  rainProb: 10,
  humidity: 65,
}

type WeatherCondition = 'sunny' | 'cloudy' | 'partly_cloudy' | 'rainy'

const weatherIcons: Record<WeatherCondition, typeof Sun> = {
  sunny: Sun,
  cloudy: Cloud,
  partly_cloudy: CloudSun,
  rainy: CloudRain,
}

// 天氣對各品類的影響係數
function getWeatherImpacts(weather: typeof mockWeather) {
  const impacts: { category: string; adjust: number; reason: string }[] = []
  const { tempHigh, rainProb, condition } = weather

  if (tempHigh >= 30) {
    impacts.push({ category: '冰品類', adjust: 20, reason: '高溫炎熱' })
    impacts.push({ category: '液體類', adjust: 10, reason: '冷飲需求增加' })
    impacts.push({ category: '加工品類', adjust: -10, reason: '熱品需求降低' })
  } else if (tempHigh <= 18) {
    impacts.push({ category: '加工品類', adjust: 20, reason: '天冷熱品需求增加' })
    impacts.push({ category: '冰品類', adjust: -30, reason: '低溫冰品需求驟降' })
  }

  if (rainProb >= 60 || condition === 'rainy') {
    impacts.push({ category: '配料類（盒裝）', adjust: -15, reason: '雨天來客減少' })
    impacts.push({ category: '主食類（袋裝）', adjust: -15, reason: '雨天來客減少' })
  }

  if (rainProb <= 20 && (condition === 'sunny' || condition === 'partly_cloudy')) {
    impacts.push({ category: '配料類（盒裝）', adjust: 10, reason: '好天氣來客增加' })
  }

  return impacts
}

export default function Order() {
  const { storeId } = useParams<{ storeId: string }>()
  const { showToast } = useToast()
  const storeName = useStoreStore((s) => s.getName(storeId || ''))
  const storeProducts = useProductStore((s) => s.items)
  const productCategories = useProductStore((s) => s.categories)

  const weatherImpacts = useMemo(() => getWeatherImpacts(mockWeather), [])
  const impactMap = useMemo(() => {
    const m: Record<string, number> = {}
    weatherImpacts.forEach(i => { m[i.category] = i.adjust })
    return m
  }, [weatherImpacts])

  // 各品類四捨五入單位
  const getRoundUnit = (product: typeof storeProducts[0]): number => {
    if (product.name === '紫米紅豆湯') return 0.5
    if (product.name === '豆花(冷)' || product.name === '豆花(熱)') return 0.5
    if (product.name === '薏仁湯' || product.name === '芋頭湯(冷)' || product.name === '芋頭湯(熱)') return 0.5
    return 1
  }

  const roundToUnit = (value: number, unit: number): number => {
    return Math.round(value / unit) * unit
  }

  const mockStock = useMemo(() => {
    const d: Record<string, number> = {}
    storeProducts.forEach(p => {
      const unit = getRoundUnit(p)
      d[p.id] = roundToUnit(Math.random() * 3, unit)
    })
    return d
  }, [])

  const mockSuggested = useMemo(() => {
    const d: Record<string, number> = {}
    storeProducts.forEach(p => {
      const base = Math.random() * 5
      const adjust = impactMap[p.category] || 0
      const raw = Math.max(0, base * (1 + adjust / 100))
      const unit = getRoundUnit(p)
      d[p.id] = roundToUnit(raw, unit)
    })
    return d
  }, [impactMap])

  const [orders, setOrders] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {}
    storeProducts.forEach(p => { init[p.id] = '' })
    return init
  })

  const [note, setNote] = useState('')
  // 固定備註項目
  const [almond1000, setAlmond1000] = useState('')
  const [almond300, setAlmond300] = useState('')
  const [bowlK520, setBowlK520] = useState('')
  const [bowl750, setBowl750] = useState('')

  const applyAllSuggestions = () => {
    const newOrders: Record<string, string> = {}
    storeProducts.forEach(p => {
      newOrders[p.id] = mockSuggested[p.id] > 0 ? String(mockSuggested[p.id]) : ''
    })
    setOrders(newOrders)
    showToast('已套用全部建議叫貨量', 'info')
  }

  const productsByCategory = useMemo(() => {
    const map = new Map<string, typeof storeProducts>()
    for (const cat of productCategories) {
      map.set(cat, storeProducts.filter(p => p.category === cat))
    }
    return map
  }, [])

  const focusNext = () => {
    const allInputs = document.querySelectorAll<HTMLInputElement>('[data-ord]')
    const arr = Array.from(allInputs)
    const idx = arr.indexOf(document.activeElement as HTMLInputElement)
    if (idx >= 0 && idx < arr.length - 1) arr[idx + 1].focus()
  }

  const handleSubmit = () => { showToast('叫貨單已提交成功！') }

  return (
    <div className="page-container">
      <TopNav title={`${storeName} 叫貨`} />

      {/* 天氣預報卡片 */}
      {(() => {
        const WeatherIcon = weatherIcons[mockWeather.condition]
        return (
          <div className="mx-4 mt-3 mb-2 rounded-card overflow-hidden border border-gray-100 bg-white">
            <div className="flex items-center gap-3 px-3 py-2.5">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-brand-amber/10">
                <WeatherIcon size={24} className="text-brand-amber" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-brand-oak">{mockWeather.date} {mockWeather.conditionText}</span>
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-brand-lotus">
                  <span className="flex items-center gap-0.5">
                    <Thermometer size={12} />
                    {mockWeather.tempLow}~{mockWeather.tempHigh}°C
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Droplets size={12} />
                    降雨 {mockWeather.rainProb}%
                  </span>
                </div>
              </div>
            </div>
            {weatherImpacts.length > 0 && (
              <div className="flex flex-wrap gap-1.5 px-3 pb-2.5 border-t border-gray-50 pt-2">
                {weatherImpacts.map((impact, i) => (
                  <span
                    key={i}
                    className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${
                      impact.adjust > 0
                        ? 'bg-status-warning/10 text-status-warning'
                        : 'bg-status-info/10 text-status-info'
                    }`}
                  >
                    {impact.adjust > 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {impact.category.replace(/（.+）/, '')} {impact.adjust > 0 ? '+' : ''}{impact.adjust}%
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      <div className="mx-4 mb-2 flex items-center gap-2 bg-status-info/10 text-status-info px-3 py-2 rounded-btn text-xs">
        <Lightbulb size={14} />
        <span>建議量已結合近7日用量 + 天氣因素計算</span>
      </div>

      <div className="mx-4 mb-3">
        <button onClick={applyAllSuggestions} className="btn-secondary !h-9 !text-sm">一鍵套用全部建議量</button>
      </div>

      <div className="flex items-center px-4 py-1 bg-surface-section text-[11px] text-brand-lotus border-b border-gray-100">
        <span className="flex-1">品項</span>
        <span className="w-[40px] text-center">庫存</span>
        <span className="w-[40px] text-center text-status-info">建議</span>
        <span className="w-[60px] text-center">叫貨量</span>
      </div>

      {Array.from(productsByCategory.entries()).map(([category, products]) => (
        <div key={category}>
          <SectionHeader title={category} icon="■" />
          <div className="bg-white">
            {products.map((product, idx) => (
              <div key={product.id} className={`flex items-center px-4 py-1.5 ${idx < products.length - 1 ? 'border-b border-gray-50' : ''}`}>
                <div className="flex-1 min-w-0 pr-1">
                  <span className="text-sm font-medium text-brand-oak">{product.name}</span>
                  <span className="text-[10px] text-brand-lotus ml-1">({product.unit})</span>
                </div>
                <span className={`w-[40px] text-center text-xs font-num ${mockStock[product.id] === 0 ? 'text-status-danger font-bold' : 'text-brand-oak'}`}>{mockStock[product.id]}</span>
                <span className="w-[40px] text-center text-xs font-num text-status-info">{mockSuggested[product.id] > 0 ? mockSuggested[product.id] : '-'}</span>
                <div className="w-[60px] flex justify-center">
                  <NumericInput value={orders[product.id]} onChange={(v) => setOrders(prev => ({ ...prev, [product.id]: v }))} isFilled onNext={focusNext} data-ord="" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* 固定備註項目 */}
      <SectionHeader title="叫貨備註" icon="■" />
      <div className="bg-white px-4 py-3">
        {/* 杏仁茶瓶 - 橫向排列 */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-brand-oak shrink-0">杏仁茶瓶</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-brand-lotus">1000ml</span>
            <NumericInput value={almond1000} onChange={setAlmond1000} unit="個" isFilled />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-brand-lotus">300ml</span>
            <NumericInput value={almond300} onChange={setAlmond300} unit="個" isFilled />
          </div>
        </div>
        {/* 紙碗 - 橫向排列 */}
        <div className="flex items-center gap-3 mb-3">
          <span className="text-sm text-brand-oak shrink-0">紙碗</span>
          <div className="flex items-center gap-1">
            <span className="text-xs text-brand-lotus">K520</span>
            <NumericInput value={bowlK520} onChange={setBowlK520} unit="箱" isFilled />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-brand-lotus">750</span>
            <NumericInput value={bowl750} onChange={setBowl750} unit="箱" isFilled />
          </div>
        </div>
        {/* 其他備註 */}
        <div className="mt-2">
          <label className="text-sm text-brand-lotus block mb-1.5">其他備註</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="有特殊需求請在此備註..."
            className="w-full h-20 rounded-input p-3 text-sm outline-none border border-gray-200 focus:border-brand-lotus resize-none"
            style={{ backgroundColor: 'var(--color-input-bg)' }} />
        </div>
      </div>

      <BottomAction label="提交叫貨單（隔日到貨）" onClick={handleSubmit} icon={<Send size={18} />} />
    </div>
  )
}
