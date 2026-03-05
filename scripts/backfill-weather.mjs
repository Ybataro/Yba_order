/**
 * 手動觸發天氣回填（跟 backfillWeather.ts 相同邏輯，但用 Node.js 直接跑）
 */
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://qshfgheqsnsghwqaqehi.supabase.co',
  'sb_publishable_xTxUuXl9Jpmo85bkKwLSSg_Y8fIiCGN'
);

function wmoToRainProb(code) {
  if (code <= 3) return 0;
  if (code <= 49) return 10;
  if (code <= 55) return 40;
  if (code <= 59) return 50;
  if (code <= 65) return 70;
  if (code <= 69) return 60;
  if (code <= 79) return 50;
  if (code <= 82) return 60;
  return 90;
}

function wmoToCondition(code) {
  if (code <= 1) return 'sunny';
  if (code <= 3) return 'partly_cloudy';
  if (code <= 49) return 'cloudy';
  return 'rainy';
}

function wmoToText(code) {
  if (code === 0) return '晴';
  if (code <= 2) return '多雲';
  if (code === 3) return '陰天';
  if (code <= 49) return '霧';
  if (code <= 55) return '毛毛雨';
  if (code <= 65) return '雨';
  if (code <= 79) return '雪';
  if (code <= 82) return '陣雨';
  return '雷暴';
}

async function main() {
  // 回填 2021-01-01 ~ 2025-12-31
  const url =
    'https://archive-api.open-meteo.com/v1/archive' +
    '?latitude=24.9994&longitude=121.4990' +
    '&start_date=2021-01-01&end_date=2025-12-31' +
    '&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum' +
    '&timezone=Asia/Taipei';

  console.log('呼叫 Open-Meteo API...');
  const res = await fetch(url);
  if (!res.ok) {
    console.error('API error:', res.status);
    return;
  }

  const json = await res.json();
  const daily = json.daily;
  console.log(`取得 ${daily.time.length} 天資料`);

  const records = daily.time.map((date, i) => {
    const code = daily.weather_code[i] ?? 0;
    const tempHigh = Math.round(daily.temperature_2m_max[i] ?? 28);
    const tempLow = Math.round(daily.temperature_2m_min[i] ?? 20);
    const precipMm = daily.precipitation_sum[i] ?? 0;
    const rainProb = wmoToRainProb(code);
    const adjustedRainProb = precipMm > 10 ? Math.max(rainProb, 80)
      : precipMm > 1 ? Math.max(rainProb, 50)
      : rainProb;

    return {
      id: `weather_${date}`,
      date,
      condition: wmoToCondition(code),
      condition_text: wmoToText(code),
      temp_high: tempHigh,
      temp_low: tempLow,
      rain_prob: adjustedRainProb,
      humidity: adjustedRainProb >= 60 ? 80 : adjustedRainProb >= 30 ? 70 : 60,
    };
  });

  // 分批 upsert
  const BATCH = 500;
  let inserted = 0;
  for (let i = 0; i < records.length; i += BATCH) {
    const batch = records.slice(i, i + BATCH);
    const { error } = await supabase
      .from('weather_records')
      .upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error('upsert error:', error.message);
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`  ${inserted}/${records.length}\r`);
  }

  console.log(`\n✅ 完成！已回填 ${inserted} 天天氣資料`);

  // 驗證
  const { count } = await supabase
    .from('weather_records')
    .select('id', { count: 'exact' })
    .gte('date', '2021-01-01');
  console.log('DB 天氣資料總數:', count);
}

main().catch(console.error);
