/**
 * 匯入 Excel 歷史叫貨資料到 Supabase
 * 用法: node scripts/import-excel-orders.mjs
 *
 * 將 Excel 各工作表的叫貨數量轉成 order_sessions + order_items 格式
 * 實際日期為 2024/11 ~ 2025/10（工作表名稱標的年份多一年）
 */
import XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';

const EXCEL_PATH = 'c:/Users/YEN/Desktop/202510月_2026樂華叫料表.xlsx';
const SUPABASE_URL = 'https://qshfgheqsnsghwqaqehi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xTxUuXl9Jpmo85bkKwLSSg_Y8fIiCGN';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Excel 品項名 → system product_id
const NAME_MAP = {
  '花生': 'p003',
  '紅豆泥': 'p001', '紅豆': 'p001',
  '綠豆泥': 'p002', '綠豆': 'p002',
  '小薏仁': 'p004',
  '花生冰淇淋(盒)': 'p024',
  '芝麻冰淇淋(盒)': 'p025',
  '花生冰淇淋(杯)': 'p026',
  '芝麻冰淇淋(杯)': 'p027',
  '草莓冰淇淋(杯)': 'p028',
  '芋泥漿': 'p006',
  '芋泥球': 'p005',
  '嫩仙草': 'p007',
  '紫米紅豆湯': 'p008',
  '粉圓糖水': 'p014',
  '銀耳湯': 'p009',
  '芝麻糊': 'p010',
  '豆花(冷)': 'p021',
  '豆花(熱)': 'p022',
  '炒糖糖水': 'p015',
  '微糖豆漿': 'p019',
  '無糖豆漿': 'p020',
  '芋圓': 'p011',
  '白玉': 'p012',
  '粉圓': 'p013',
  '芝麻湯圓': 'p016',
  '杏仁茶': 'p023',
  '蔗片冰': 'p029',
  '鮮奶': 'p017',
  '薑汁': 'p032',
  '薏仁湯': 'p035',
};

// 統計項目（跳過）
const SKIP_ITEMS = new Set([
  '人力', '加盟實際成本', '加盟成本', '加盟成本38%', '加盟成本38',
  '妹成本%', '客單價', '每日號數', '我們成本%', '我們的成本',
]);

// 工作表名 → store_id
function getStoreId(sheetName) {
  return sheetName.includes('興南') ? 'xingnan' : 'lehua';
}

function parseSheet(wb, sheetName) {
  const ws = wb.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const storeId = getStoreId(sheetName);

  // Row 1: 日期行（Excel serial numbers）
  const dateCols = []; // { col, date: 'YYYY-MM-DD' }
  for (let c = 1; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 1, c })];
    if (cell && typeof cell.v === 'number' && cell.v > 40000) {
      const d = XLSX.SSF.parse_date_code(cell.v);
      if (d) {
        const dateStr = `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
        dateCols.push({ col: c, date: dateStr });
      }
    }
  }

  // Row 3+: 品項行
  const itemRows = []; // { row, name, productId }
  for (let r = 3; r <= range.e.r; r++) {
    const cell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (!cell || !cell.v) continue;
    const name = String(cell.v).trim();
    if (!name || SKIP_ITEMS.has(name)) continue;
    if (name.includes('營業額') || name.includes('統計') || name.includes('總成本')) continue;

    const productId = NAME_MAP[name];
    if (!productId) {
      // 季節性品項（泰奶冰淇淋、鳳梨蜜等），跳過
      continue;
    }
    itemRows.push({ row: r, name, productId });
  }

  // 逐日逐品項讀取叫貨量
  const records = []; // { storeId, date, productId, quantity }
  for (const { col, date } of dateCols) {
    for (const { row, productId } of itemRows) {
      const cell = ws[XLSX.utils.encode_cell({ r: row, c: col })];
      const qty = cell ? parseFloat(cell.v) : 0;
      if (qty > 0) {
        records.push({ storeId, date, productId, quantity: qty });
      }
    }
  }

  return { storeId, records, dateRange: dateCols.length > 0 ? `${dateCols[0].date} ~ ${dateCols[dateCols.length - 1].date}` : 'N/A' };
}

async function main() {
  console.log('讀取 Excel...');
  const wb = XLSX.readFile(EXCEL_PATH);

  let allRecords = [];
  for (const name of wb.SheetNames) {
    const result = parseSheet(wb, name);
    console.log(`  ${name} | ${result.storeId} | ${result.dateRange} | ${result.records.length} 筆`);
    allRecords.push(...result.records);
  }
  console.log(`\n共 ${allRecords.length} 筆叫貨紀錄`);

  // 按 storeId + date 分組 → 建立 sessions + items
  const sessionMap = new Map(); // key: storeId_date → items[]
  for (const r of allRecords) {
    const key = `${r.storeId}_${r.date}`;
    if (!sessionMap.has(key)) {
      sessionMap.set(key, { storeId: r.storeId, date: r.date, items: [] });
    }
    // 同品項可能重複（同一天同品項不同列），加總
    const existing = sessionMap.get(key).items.find(i => i.productId === r.productId);
    if (existing) {
      existing.quantity += r.quantity;
    } else {
      sessionMap.get(key).items.push({ productId: r.productId, quantity: r.quantity });
    }
  }

  console.log(`\n共 ${sessionMap.size} 個叫貨日`);

  // 準備 Supabase upsert 資料
  const sessions = [];
  const items = [];

  for (const [key, s] of sessionMap) {
    const sessionId = key; // storeId_date
    sessions.push({
      id: sessionId,
      store_id: s.storeId,
      date: s.date,
      deadline: (() => {
        const [y, m, d] = s.date.split('-').map(Number);
        return new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0)).toISOString();
      })(),
      note: '歷史匯入',
      submitted_by: null,
      updated_at: new Date().toISOString(),
    });

    for (const item of s.items) {
      items.push({
        session_id: sessionId,
        product_id: item.productId,
        quantity: item.quantity,
      });
    }
  }

  console.log(`\nSessions: ${sessions.length}, Items: ${items.length}`);

  // 先看看 DB 是否已有這些日期的 lehua 資料
  const { data: existing } = await supabase
    .from('order_sessions')
    .select('id')
    .eq('store_id', 'lehua')
    .gte('date', '2024-11-01')
    .lte('date', '2025-10-31')
    .limit(5);

  if (existing && existing.length > 0) {
    console.log(`\n⚠️  DB 已有 ${existing.length}+ 筆樂華歷史叫貨資料（如 ${existing[0].id}）`);
    console.log('   如要覆寫，請加 --force 參數');
    if (!process.argv.includes('--force')) {
      console.log('   退出。');
      return;
    }
    console.log('   --force 模式：繼續 upsert...');
  }

  // Batch upsert sessions
  console.log('\n匯入 order_sessions...');
  const BATCH = 200;
  let sOk = 0, sFail = 0;
  for (let i = 0; i < sessions.length; i += BATCH) {
    const batch = sessions.slice(i, i + BATCH);
    const { error } = await supabase
      .from('order_sessions')
      .upsert(batch, { onConflict: 'id' });
    if (error) {
      console.error('  session upsert error:', error.message);
      sFail += batch.length;
    } else {
      sOk += batch.length;
    }
  }
  console.log(`  sessions: ${sOk} ok, ${sFail} fail`);

  // Batch upsert items
  console.log('匯入 order_items...');
  let iOk = 0, iFail = 0;
  for (let i = 0; i < items.length; i += BATCH) {
    const batch = items.slice(i, i + BATCH);
    const { error } = await supabase
      .from('order_items')
      .upsert(batch, { onConflict: 'session_id,product_id' });
    if (error) {
      console.error('  item upsert error:', error.message);
      iFail += batch.length;
    } else {
      iOk += batch.length;
    }
  }
  console.log(`  items: ${iOk} ok, ${iFail} fail`);

  console.log('\n✅ 完成！');
}

main().catch(console.error);
