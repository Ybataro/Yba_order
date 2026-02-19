import { supabase } from '@/lib/supabase'
import { getTodayTW } from '@/lib/session'

export type WeatherCondition = 'sunny' | 'cloudy' | 'partly_cloudy' | 'rainy'

export interface WeatherData {
  date: string
  condition: WeatherCondition
  conditionText: string
  tempHigh: number
  tempLow: number
  rainProb: number
  humidity: number
}

const defaultWeather: WeatherData = {
  date: '明日',
  condition: 'partly_cloudy',
  conditionText: '多雲',
  tempHigh: 28,
  tempLow: 20,
  rainProb: 30,
  humidity: 70,
}

/** Map CWA weather description to our WeatherCondition */
function mapCondition(wx: string): { condition: WeatherCondition; conditionText: string } {
  const lower = wx.toLowerCase()
  if (lower.includes('雨') || lower.includes('雷')) {
    return { condition: 'rainy', conditionText: wx }
  }
  if (lower.includes('陰') || lower.includes('雲')) {
    if (lower.includes('晴')) {
      return { condition: 'partly_cloudy', conditionText: wx }
    }
    return { condition: 'cloudy', conditionText: wx }
  }
  if (lower.includes('晴')) {
    return { condition: 'sunny', conditionText: wx }
  }
  return { condition: 'partly_cloudy', conditionText: wx }
}

/**
 * Fetch tomorrow's weather for 新北市 from CWA open data API.
 * Returns default weather on failure or missing API key.
 */
export async function fetchWeather(): Promise<WeatherData> {
  const apiKey = import.meta.env.VITE_CWA_API_KEY as string
  if (!apiKey) return defaultWeather

  try {
    const url = `https://opendata.cwa.gov.tw/api/v1/rest/datastore/F-C0032-001?Authorization=${apiKey}&locationName=${encodeURIComponent('新北市')}`
    const res = await fetch(url)
    if (!res.ok) return defaultWeather

    const json = await res.json()
    const location = json?.records?.location?.[0]
    if (!location) return defaultWeather

    const elements = location.weatherElement as Array<{
      elementName: string
      time: Array<{ startTime: string; endTime: string; parameter: { parameterName: string; parameterValue?: string } }>
    }>

    // Find the forecast period closest to tomorrow
    // CWA returns 3 time periods (each 12h), pick the 2nd or 3rd for "tomorrow"
    const wxEl = elements.find(e => e.elementName === 'Wx')
    const maxTEl = elements.find(e => e.elementName === 'MaxT')
    const minTEl = elements.find(e => e.elementName === 'MinT')
    const popEl = elements.find(e => e.elementName === 'PoP')
    const ciEl = elements.find(e => e.elementName === 'CI')

    // Use index 1 (second period = roughly tomorrow daytime) if available
    const idx = wxEl && wxEl.time.length > 1 ? 1 : 0

    const wxText = wxEl?.time[idx]?.parameter.parameterName || '多雲'
    const maxT = parseInt(maxTEl?.time[idx]?.parameter.parameterName || '28')
    const minT = parseInt(minTEl?.time[idx]?.parameter.parameterName || '20')
    const pop = parseInt(popEl?.time[idx]?.parameter.parameterName || '30')
    const { condition, conditionText } = mapCondition(wxText)

    // CI doesn't have humidity directly — use a rough estimate based on rain prob
    const humidity = pop >= 60 ? 80 : pop >= 30 ? 70 : 60
    void ciEl // CI is comfort index, not used for humidity

    const result: WeatherData = {
      date: '明日',
      condition,
      conditionText,
      tempHigh: maxT,
      tempLow: minT,
      rainProb: pop,
      humidity,
    }

    // Fire-and-forget: save to DB
    saveWeatherRecord(result).catch(() => {})

    return result
  } catch {
    return defaultWeather
  }
}

/** Save weather record to Supabase (upsert by date) */
async function saveWeatherRecord(weather: WeatherData): Promise<void> {
  if (!supabase) return

  // fetchWeather returns tomorrow's forecast
  const today = getTodayTW()
  const d = new Date(today + 'T00:00:00')
  d.setDate(d.getDate() + 1)
  const tomorrow = d.toLocaleDateString('en-CA')

  await supabase.from('weather_records').upsert(
    {
      id: `weather_${tomorrow}`,
      date: tomorrow,
      condition: weather.condition,
      condition_text: weather.conditionText,
      temp_high: weather.tempHigh,
      temp_low: weather.tempLow,
      rain_prob: weather.rainProb,
      humidity: weather.humidity,
    },
    { onConflict: 'id' },
  )
}
