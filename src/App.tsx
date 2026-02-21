import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import { useInitStores } from '@/hooks/useInitStores'
import AuthGuard from '@/components/AuthGuard'
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

function Loading() {
  return (
    <div className="flex items-center justify-center py-20 text-sm text-brand-lotus">
      載入中...
    </div>
  )
}

function App() {
  useInitStores()

  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="max-w-lg mx-auto min-h-screen" style={{ backgroundColor: 'var(--color-page-bg)' }}>
          <OfflineBanner />
          <Suspense fallback={<Loading />}>
            <Routes>
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
                <Route path="/kitchen/expense" element={<KitchenDailyExpense />} />
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
              </Route>
            </Routes>
          </Suspense>
        </div>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
