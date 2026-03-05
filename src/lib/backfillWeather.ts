/**
 * 一次性回填 2021-2025 歷史天氣到 Supabase weather_records
 * 資料來源：Open-Meteo Historical API（免費、免註冊）
 * 座標：中和區 (24.9994, 121.4990)
 */
import { supabase } from '@/lib/supabase'

const BACKFILL_KEY = 'weather_backfill_done'

/** WMO 天氣代碼 → 降雨機率（用於 rain_prob 欄位） */
function wmoToRainProb(code: number): number {
  if (code <= 3) return 0       // 晴/雲
  if (code <= 49) return 10     // 霧
  if (code <= 55) return 40     // 毛毛雨
  if (code <= 59) return 50     // 凍雨
  if (code <= 65) return 70     // 雨
  if (code <= 69) return 60     // 凍雨
  if (code <= 79) return 50     // 雪
  if (code <= 82) return 60     // 陣雨
  if (code <= 86) return 50     // 雪陣雨
  return 90                     // 雷暴 95-99
}

/** WMO 天氣代碼 → WeatherCondition */
function wmoToCondition(code: number): string {
  if (code <= 1) return 'sunny'
  if (code <= 3) return 'partly_cloudy'
  if (code <= 49) return 'cloudy'
  return 'rainy'
}

/** WMO 天氣代碼 → 中文說明 */
function wmoToText(code: number): string {
  if (code === 0) return '晴'
  if (code <= 2) return '多雲'
  if (code === 3) return '陰天'
  if (code <= 49) return '霧'
  if (code <= 55) return '毛毛雨'
  if (code <= 65) return '雨'
  if (code <= 79) return '雪'
  if (code <= 82) return '陣雨'
  return '雷暴'
}

interface OpenMeteoDaily {
  time: string[]
  weather_code: number[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  precipitation_sum: number[]
}

/**
 * 檢查是否需要回填，需要則執行。
 * 回填完成後設 localStorage flag，下次不再執行。
 */
export async function backfillWeatherIfNeeded(): Promise<void> {
  if (!supabase) return
  if (localStorage.getItem(BACKFILL_KEY)) return

  // 快速檢查 DB 是否已有 2021 年資料
  const { data: check } = await supabase
    .from('weather_records')
    .select('id')
    .gte('date', '2021-01-01')
    .lte('date', '2021-01-31')
    .limit(1)

  if (check && check.length > 0) {
    localStorage.setItem(BACKFILL_KEY, '1')
    return
  }

  console.log('[backfillWeather] 開始回填 2021-2025 歷史天氣...')

  try {
    const url =
      'https://archive-api.open-meteo.com/v1/archive' +
      '?latitude=24.9994&longitude=121.4990' +
      '&start_date=2021-01-01&end_date=2025-12-31' +
      '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum' +
      '&timezone=Asia/Taipei'

    const res = await fetch(url)
    if (!res.ok) {
      console.warn('[backfillWeather] Open-Meteo API 回傳非 200:', res.status)
      return
    }

    const json = await res.json()
    const daily: OpenMeteoDaily = json.daily
    if (!daily?.time?.length) {
      console.warn('[backfillWeather] 無資料')
      return
    }

    // 轉換成 weather_records 格式
    const records = daily.time.map((date: string, i: number) => {
      const code = daily.weather_code[i] ?? 0
      const tempHigh = Math.round(daily.temperature_2m_max[i] ?? 28)
      const tempLow = Math.round(daily.temperature_2m_min[i] ?? 20)
      const precipMm = daily.precipitation_sum[i] ?? 0
      const rainProb = wmoToRainProb(code)
      const condition = wmoToCondition(code)
      const conditionText = wmoToText(code)

      // rain_prob 結合 WMO code + 實際降雨量：有實際降雨 > 1mm 時強制提高 rain_prob
      const adjustedRainProb = precipMm > 10 ? Math.max(rainProb, 80)
        : precipMm > 1 ? Math.max(rainProb, 50)
        : rainProb

      return {
        id: `weather_${date}`,
        date,
        condition,
        condition_text: conditionText,
        temp_high: tempHigh,
        temp_low: tempLow,
        rain_prob: adjustedRainProb,
        humidity: adjustedRainProb >= 60 ? 80 : adjustedRainProb >= 30 ? 70 : 60,
      }
    })

    // 分批 upsert（Supabase 單次最多約 1000 筆）
    const BATCH = 500
    let inserted = 0
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH)
      const { error } = await supabase
        .from('weather_records')
        .upsert(batch, { onConflict: 'id' })

      if (error) {
        console.warn('[backfillWeather] upsert 錯誤:', error.message)
        // 繼續嘗試下一批
      } else {
        inserted += batch.length
      }
    }

    console.log(`[backfillWeather] 完成！已回填 ${inserted} 天天氣資料`)
    localStorage.setItem(BACKFILL_KEY, '1')
  } catch (err) {
    console.warn('[backfillWeather] 回填失敗:', err)
  }
}
