import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import { useInitStores } from '@/hooks/useInitStores'
import AuthGuard from '@/components/AuthGuard'
import ScheduleGuard from '@/components/ScheduleGuard'
import ErrorBoundary from '@/components/ErrorBoundary'
import OfflineBanner from '@/components/OfflineBanner'

// Store pages
const StoreHome = lazy(() => import('@/pages/store/StoreHome'))
const Inventory = lazy(() => import('@/pages/store/Inventory'))
const Settlement = lazy(() => import('@/pages/store/Settlement'))
const Usage = lazy(() => import('@/pages/store/Usage'))
const Order = lazy(() => import('@/pages/store/Order'))
const Receive = lazy(() => import('@/pages/store/Receive'))
const StoreDailyExpense = lazy(() => import('@/pages/store/DailyExpense'))
const StoreOrderHistory = lazy(() => import('@/pages/store/OrderHistory'))

// Kitchen pages
const KitchenHome = lazy(() => import('@/pages/kitchen/KitchenHome'))
const OrderSummary = lazy(() => import('@/pages/kitchen/OrderSummary'))
const Shipment = lazy(() => import('@/pages/kitchen/Shipment'))
const MaterialStock = lazy(() => import('@/pages/kitchen/MaterialStock'))
const ProductStock = lazy(() => import('@/pages/kitchen/ProductStock'))
const MaterialOrder = lazy(() => import('@/pages/kitchen/MaterialOrder'))
const ProductionSchedule = lazy(() => import('@/pages/kitchen/ProductionSchedule'))
const KitchenDailyExpense = lazy(() => import('@/pages/kitchen/DailyExpense'))
const KitchenSchedules = lazy(() => import('@/pages/kitchen/Schedules'))

// Store pages (schedule)
const StoreSchedules = lazy(() => import('@/pages/store/Schedules'))

// Admin pages
const AdminHome = lazy(() => import('@/pages/admin/AdminHome'))
const ProductManager = lazy(() => import('@/pages/admin/ProductManager'))
const MaterialManager = lazy(() => import('@/pages/admin/MaterialManager'))
const StaffManager = lazy(() => import('@/pages/admin/StaffManager'))
const StoreManager = lazy(() => import('@/pages/admin/StoreManager'))
const SettlementManager = lazy(() => import('@/pages/admin/SettlementManager'))
const QRCodePage = lazy(() => import('@/pages/admin/QRCodePage'))
const ZoneManager = lazy(() => import('@/pages/admin/ZoneManager'))
const OrderHistory = lazy(() => import('@/pages/admin/OrderHistory'))
const SettlementHistory = lazy(() => import('@/pages/admin/SettlementHistory'))
const OrderPricing = lazy(() => import('@/pages/admin/OrderPricing'))
const WeatherAnalysis = lazy(() => import('@/pages/admin/WeatherAnalysis'))
const BossDashboard = lazy(() => import('@/pages/admin/BossDashboard'))
const PinManager = lazy(() => import('@/pages/admin/PinManager'))
const AuditLog = lazy(() => import('@/pages/admin/AuditLog'))
const ExpenseManagement = lazy(() => import('@/pages/admin/ExpenseManagement'))
const ProfitLoss = lazy(() => import('@/pages/admin/ProfitLoss'))
const ShiftTypeManager = lazy(() => import('@/pages/admin/ShiftTypeManager'))
const ScheduleStats = lazy(() => import('@/pages/admin/ScheduleStats'))
const FrozenStats = lazy(() => import('@/pages/admin/FrozenStats'))
const AdminSchedule = lazy(() => import('@/pages/admin/AdminSchedule'))
const ItemSortManager = lazy(() => import('@/pages/admin/ItemSortManager'))
const LeaveManagement = lazy(() => import('@/pages/admin/LeaveManagement'))

function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
      載入中...
    </div>
  )
}

/** 全寬佈局（PC 排班等大螢幕頁面） */
function WideLayout() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: 'var(--color-page-bg)' }}>
      <OfflineBanner />
      <Outlet />
    </div>
  )
}

/** 手機寬度佈局（現有全部頁面） */
function NarrowLayout() {
  return (
    <div className="max-w-lg mx-auto min-h-screen" style={{ backgroundColor: 'var(--color-page-bg)' }}>
      <OfflineBanner />
      <Outlet />
    </div>
  )
}

function App() {
  useInitStores()

  return (
    <ErrorBoundary>
    <BrowserRouter>
      <ToastProvider>
        <Suspense fallback={<Loading />}>
          <Routes>
            {/* 全寬路由（排班管理：需 can_schedule 權限） */}
            <Route element={<WideLayout />}>
              <Route element={<AuthGuard requiredRole={['admin', 'kitchen', 'store']} />}>
                <Route element={<ScheduleGuard />}>
                  <Route path="/admin/schedule" element={<AdminSchedule />} />
                </Route>
              </Route>
            </Route>

            {/* 手機寬度路由（現有全部） */}
            <Route element={<NarrowLayout />}>
              {/* Default redirect */}
              <Route path="/" element={<Navigate to="/store/lehua" replace />} />

              {/* Store routes */}
              <Route element={<AuthGuard requiredRole="store" />}>
                <Route path="/store/:storeId" element={<StoreHome />} />
                <Route path="/store/:storeId/inventory" element={<Inventory />} />
                <Route path="/store/:storeId/settlement" element={<Settlement />} />
                <Route path="/store/:storeId/usage" element={<Usage />} />
                <Route path="/store/:storeId/order" element={<Order />} />
                <Route path="/store/:storeId/receive" element={<Receive />} />
                <Route path="/store/:storeId/order-history" element={<StoreOrderHistory />} />
                <Route path="/store/:storeId/expense" element={<StoreDailyExpense />} />
                <Route path="/store/:storeId/schedule" element={<StoreSchedules />} />
              </Route>

              {/* Kitchen routes */}
              <Route element={<AuthGuard requiredRole="kitchen" />}>
                <Route path="/kitchen" element={<KitchenHome />} />
                <Route path="/kitchen/orders" element={<OrderSummary />} />
                <Route path="/kitchen/shipments" element={<Shipment />} />
                <Route path="/kitchen/materials" element={<MaterialStock />} />
                <Route path="/kitchen/products" element={<ProductStock />} />
                <Route path="/kitchen/material-orders" element={<MaterialOrder />} />
                <Route path="/kitchen/schedule" element={<ProductionSchedule />} />
                <Route path="/kitchen/staff-schedule" element={<KitchenSchedules />} />
                <Route path="/kitchen/expense" element={<KitchenDailyExpense />} />
              </Route>

              {/* 排班相關：需 can_schedule 權限（任何角色） */}
              <Route element={<AuthGuard requiredRole={['admin', 'kitchen', 'store']} />}>
                <Route element={<ScheduleGuard />}>
                  <Route path="/admin/shift-types" element={<ShiftTypeManager />} />
                  <Route path="/admin/schedule-stats" element={<ScheduleStats />} />
                </Route>
              </Route>

              {/* Admin routes */}
              <Route element={<AuthGuard requiredRole="admin" />}>
                <Route path="/admin" element={<AdminHome />} />
                <Route path="/admin/dashboard" element={<BossDashboard />} />
                <Route path="/admin/products" element={<ProductManager />} />
                <Route path="/admin/materials" element={<MaterialManager />} />
                <Route path="/admin/staff" element={<StaffManager />} />
                <Route path="/admin/stores" element={<StoreManager />} />
                <Route path="/admin/settlement-fields" element={<SettlementManager />} />
                <Route path="/admin/qrcode" element={<QRCodePage />} />
                <Route path="/admin/zones" element={<ZoneManager />} />
                <Route path="/admin/order-history" element={<OrderHistory />} />
                <Route path="/admin/settlement-history" element={<SettlementHistory />} />
                <Route path="/admin/order-pricing" element={<OrderPricing />} />
                <Route path="/admin/weather-analysis" element={<WeatherAnalysis />} />
                <Route path="/admin/pins" element={<PinManager />} />
                <Route path="/admin/audit" element={<AuditLog />} />
                <Route path="/admin/expenses" element={<ExpenseManagement />} />
                <Route path="/admin/profit-loss" element={<ProfitLoss />} />
                <Route path="/admin/frozen-stats" element={<FrozenStats />} />
                <Route path="/admin/item-sort" element={<ItemSortManager />} />
                <Route path="/admin/leave" element={<LeaveManagement />} />
              </Route>
            </Route>
          </Routes>
        </Suspense>
      </ToastProvider>
    </BrowserRouter>
    </ErrorBoundary>
  )
}

export default App
