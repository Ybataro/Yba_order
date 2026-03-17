/**
 * 匯入樂華叫料表 Excel 歷史資料
 *
 * 用法: node scripts/import-excel-history.js
 *
 * 匯入目標:
 * - order_sessions + order_items: 歷史叫貨量
 * - daily_revenue: 每日營業額
 */
const XLSX = require('xlsx');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = 'https://qshfgheqsnsghwqaqehi.supabase.co';
const SUPABASE_KEY = 'sb_publishable_xTxUuXl9Jpmo85bkKwLSSg_Y8fIiCGN';
const EXCEL_PATH = 'c:\\Users\\YEN\\Desktop\\樂華叫料表.xlsx';
const STORE_ID = 'lehua';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

// Excel 產品名 → 系統 product_id 對應表
const NAME_TO_ID = {
  '花生': 'p003',
  '小薏仁': 'p004',
  '芋泥球': 'p005',
  '芋泥漿': 'p006',
  '嫩仙草': 'p007',
  '紫米紅豆湯': 'p008',
  '銀耳湯': 'p009',
  '芝麻糊': 'p010',
  '芋圓': 'p011',
  '白玉': 'p012',
  '粉圓': 'p013',
  '粉圓糖水': 'p014',
  '炒糖糖水': 'p015',
  '芝麻湯圓': 'p016',
  '鮮奶': 'p017',
  '微糖豆漿': 'p019',
  '無糖豆漿': 'p020',
  '豆花(冷)': 'p021',
  '豆花(熱)': 'p022',
  '杏仁茶': 'p023',
  '花生冰淇淋(盒)': 'p024',
  '芝麻冰淇淋(盒)': 'p025',
  '花生冰淇淋(杯)': 'p026',
  '芝麻冰淇淋(杯)': 'p027',
  '草莓冰淇淋(杯)': 'p028',
  '蔗片冰': 'p029',
  '薏仁湯': 'p035',
  // 名稱變體
  '紅豆泥': 'p001',
  '紅豆': 'p001',
  '綠豆泥': 'p002',
  '綠豆': 'p002',
  '薑汁': 'p032',
  '冷凍薑汁': 'p032',
};

// 跳過的產品（系統中不存在）
const SKIP_NAMES = new Set(['鳳梨蜜', '泰奶冰淇淋(杯)', '泰奶冰淇淋(盒)', '樂華營業額']);

function excelDateToISO(serial) {
  // Excel serial number → JS Date → YYYY-MM-DD
  const utcDays = Math.floor(serial - 25569);
  const d = new Date(utcDays * 86400 * 1000);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function parseSheet(ws) {
  const range = XLSX.utils.decode_range(ws['!ref']);
  const maxCol = range.e.c;
  const maxRow = range.e.r;

  // Row 1 (0-indexed): dates in columns B onwards
  const dateColumns = []; // { col, dateStr }
  for (let c = 1; c <= maxCol; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 1, c })];
    if (!cell || cell.v == null) continue;
    const serial = typeof cell.v === 'number' ? cell.v : parseFloat(cell.v);
    if (isNaN(serial) || serial < 40000 || serial > 50000) continue; // not a date serial
    const dateStr = excelDateToISO(serial);
    dateColumns.push({ col: c, dateStr });
  }

  // Row 3+ (0-indexed): product data
  const orders = []; // { date, productId, quantity }
  const revenues = []; // { date, revenue }

  for (let r = 3; r <= maxRow; r++) {
    const nameCell = ws[XLSX.utils.encode_cell({ r, c: 0 })];
    if (!nameCell || !nameCell.v) continue;
    const name = String(nameCell.v).trim();

    if (name === '樂華營業額') {
      // Revenue row
      for (const { col, dateStr } of dateColumns) {
        const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
        if (!cell || cell.v == null) continue;
        const val = typeof cell.v === 'number' ? cell.v : parseFloat(cell.v);
        if (isNaN(val) || val <= 0) continue;
        revenues.push({ date: dateStr, revenue: val });
      }
      continue;
    }

    if (SKIP_NAMES.has(name)) continue;

    const productId = NAME_TO_ID[name];
    if (!productId) {
      console.warn(`  ⚠ 未知產品名: "${name}" — 跳過`);
      continue;
    }

    for (const { col, dateStr } of dateColumns) {
      const cell = ws[XLSX.utils.encode_cell({ r, c: col })];
      if (!cell || cell.v == null) continue;
      const qty = typeof cell.v === 'number' ? cell.v : parseFloat(cell.v);
      if (isNaN(qty)) continue;
      // Include 0 quantities too (explicit zero means no order that day for this product)
      orders.push({ date: dateStr, productId, quantity: qty });
    }
  }

  return { orders, revenues, dateColumns };
}

async function upsertOrderSessions(allDates) {
  // Create order_sessions for each unique date
  const sessions = allDates.map(date => ({
    id: `${STORE_ID}_${date}`,
    store_id: STORE_ID,
    date,
    deadline: `${date}T00:00:00+08:00`,
    note: 'Excel匯入歷史資料',
    submitted_by: 'import',
  }));

  // Batch upsert in chunks of 100
  const chunkSize = 100;
  let created = 0;
  for (let i = 0; i < sessions.length; i += chunkSize) {
    const chunk = sessions.slice(i, i + chunkSize);
    const { error } = await sb.from('order_sessions').upsert(chunk, {
      onConflict: 'id',
      ignoreDuplicates: true
    });
    if (error) {
      console.error(`  ✗ order_sessions upsert error at chunk ${i}:`, error.message);
    } else {
      created += chunk.length;
    }
  }
  console.log(`  ✓ order_sessions: ${created} 筆`);
}

async function upsertOrderItems(allOrders) {
  // Group by session_id to avoid duplicates
  // First delete existing imported items for these sessions
  const sessionIds = [...new Set(allOrders.map(o => `${STORE_ID}_${o.date}`))];

  // Delete in chunks
  const delChunk = 50;
  for (let i = 0; i < sessionIds.length; i += delChunk) {
    const chunk = sessionIds.slice(i, i + delChunk);
    const { error } = await sb.from('order_items')
      .delete()
      .in('session_id', chunk);
    if (error) {
      console.error(`  ✗ delete error at chunk ${i}:`, error.message);
    }
  }

  // Insert all order items
  const items = allOrders
    .filter(o => o.quantity > 0) // Only insert positive quantities
    .map(o => ({
      session_id: `${STORE_ID}_${o.date}`,
      product_id: o.productId,
      quantity: o.quantity,
    }));

  const chunkSize = 500;
  let inserted = 0;
  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize);
    const { error } = await sb.from('order_items').insert(chunk);
    if (error) {
      console.error(`  ✗ order_items insert error at chunk ${i}:`, error.message);
    } else {
      inserted += chunk.length;
    }
  }
  console.log(`  ✓ order_items: ${inserted} 筆`);
}

async function upsertRevenues(allRevenues) {
  const rows = allRevenues.map(r => ({
    store_id: STORE_ID,
    date: r.date,
    revenue: r.revenue,
  }));

  const chunkSize = 100;
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await sb.from('daily_revenue').upsert(chunk, {
      onConflict: 'store_id,date',
    });
    if (error) {
      console.error(`  ✗ daily_revenue upsert error at chunk ${i}:`, error.message);
    } else {
      upserted += chunk.length;
    }
  }
  console.log(`  ✓ daily_revenue: ${upserted} 筆`);
}

async function main() {
  console.log('📊 開始匯入樂華叫料表...\n');

  const wb = XLSX.readFile(EXCEL_PATH);
  const allOrders = [];
  const allRevenues = [];
  const allDates = new Set();
  const unmatchedNames = new Set();

  for (const sheetName of wb.SheetNames) {
    console.log(`📄 處理: ${sheetName}`);
    const ws = wb.Sheets[sheetName];
    const { orders, revenues, dateColumns } = parseSheet(ws);

    console.log(`   日期: ${dateColumns.length} 天, 叫貨: ${orders.length} 筆, 營業額: ${revenues.length} 筆`);

    for (const o of orders) {
      allOrders.push(o);
      allDates.add(o.date);
    }
    for (const r of revenues) {
      allRevenues.push(r);
      allDates.add(r.date);
    }
  }

  // Deduplicate revenues by date (keep latest)
  const revenueMap = new Map();
  for (const r of allRevenues) {
    revenueMap.set(r.date, r.revenue);
  }
  const uniqueRevenues = [...revenueMap.entries()].map(([date, revenue]) => ({ date, revenue }));

  // Deduplicate orders by date+productId (keep latest)
  const orderMap = new Map();
  for (const o of allOrders) {
    const key = `${o.date}_${o.productId}`;
    orderMap.set(key, o);
  }
  const uniqueOrders = [...orderMap.values()];

  const sortedDates = [...allDates].sort();
  console.log(`\n📋 匯總:`);
  console.log(`   日期範圍: ${sortedDates[0]} ~ ${sortedDates[sortedDates.length - 1]}`);
  console.log(`   唯一日期: ${sortedDates.length} 天`);
  console.log(`   叫貨記錄: ${uniqueOrders.length} 筆 (去重後)`);
  console.log(`   營業額記錄: ${uniqueRevenues.length} 筆 (去重後)`);

  console.log(`\n🔄 寫入 Supabase...`);

  await upsertOrderSessions(sortedDates);
  await upsertOrderItems(uniqueOrders);
  await upsertRevenues(uniqueRevenues);

  console.log(`\n✅ 匯入完成！`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
