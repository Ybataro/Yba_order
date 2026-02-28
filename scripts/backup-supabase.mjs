/**
 * Supabase 全資料表備份腳本
 * 用法：node scripts/backup-supabase.mjs
 * 輸出：backup/YYYY-MM-DD/ 目錄下每張表一個 JSON 檔
 */
import { createClient } from '@supabase/supabase-js'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'

const SUPABASE_URL = 'https://qshfgheqsnsghwqaqehi.supabase.co'
const SUPABASE_KEY = 'sb_publishable_xTxUuXl9Jpmo85bkKwLSSg_Y8fIiCGN'

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// 所有資料表名稱
const TABLES = [
  // 基礎 (6)
  'stores', 'store_products', 'staff', 'product_categories', 'category_sort_orders', 'frozen_product_defs',
  // 樓層 (2)
  'store_zones', 'zone_products',
  // 營運 (10)
  'inventory_sessions', 'inventory_items',
  'order_sessions', 'order_items',
  'settlement_sessions', 'settlement_values',
  'shipment_sessions', 'shipment_items',
  'material_stock_sessions', 'material_stock_items',
  // 天氣 (1)
  'weather_records',
  // 權限 (2)
  'user_pins', 'audit_logs',
  // 費用 (3)
  'daily_expenses', 'frozen_sales',
  // 排班 (2+)
  'shift_types', 'schedules', 'tag_presets', 'positions',
  // 庫存批次 (1)
  'inventory_stock_entries',
  // 其他可能的表
  'product_stock_sessions', 'product_stock_items',
  'material_order_sessions', 'material_order_items',
  // 系統設定 (1)
  'app_settings',
  // 品項排序 (1)
  'store_item_sort',
  // 消耗品追蹤 (1)
  'supply_tracker',
  // 請假 (2)
  'leave_requests', 'leave_balances',
]

async function backup() {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Taipei' })
  const dir = join(process.cwd(), 'backup', today)
  mkdirSync(dir, { recursive: true })

  let successCount = 0
  let skipCount = 0
  const summary = []

  for (const table of TABLES) {
    try {
      // 用分頁方式取全部資料（每次 1000 筆）
      let allRows = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from(table)
          .select('*')
          .range(from, from + pageSize - 1)

        if (error) {
          console.log(`  ⚠ ${table}: ${error.message}`)
          summary.push({ table, rows: 0, status: 'error' })
          skipCount++
          break
        }

        allRows = allRows.concat(data)

        if (data.length < pageSize) {
          // 寫入 JSON
          const filePath = join(dir, `${table}.json`)
          writeFileSync(filePath, JSON.stringify(allRows, null, 2), 'utf-8')
          console.log(`  ✓ ${table}: ${allRows.length} rows`)
          summary.push({ table, rows: allRows.length, status: 'ok' })
          successCount++
          break
        }

        from += pageSize
      }
    } catch (err) {
      console.log(`  ✗ ${table}: ${err.message}`)
      summary.push({ table, rows: 0, status: 'skip' })
      skipCount++
    }
  }

  // 寫入摘要
  const summaryPath = join(dir, '_summary.json')
  writeFileSync(summaryPath, JSON.stringify({
    backupDate: today,
    timestamp: new Date().toISOString(),
    tables: summary,
    totalSuccess: successCount,
    totalSkipped: skipCount,
  }, null, 2), 'utf-8')

  console.log(`\n備份完成：${dir}`)
  console.log(`成功 ${successCount} 張表，跳過 ${skipCount} 張`)
}

backup().catch(console.error)
