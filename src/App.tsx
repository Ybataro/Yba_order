import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import { useInitStores } from '@/hooks/useInitStores'
import AuthGuard from '@/components/AuthGuard'
import OfflineBanner from '@/components/OfflineBanner'

import StoreHome from '@/pages/store/StoreHome'
import Inventory from '@/pages/store/Inventory'
import Settlement from '@/pages/store/Settlement'
import Usage from '@/pages/store/Usage'
import Order from '@/pages/store/Order'
import Receive from '@/pages/store/Receive'
import StoreDailyExpense from '@/pages/store/DailyExpense'

import KitchenHome from '@/pages/kitchen/KitchenHome'
import OrderSummary from '@/pages/kitchen/OrderSummary'
import Shipment from '@/pages/kitchen/Shipment'
import MaterialStock from '@/pages/kitchen/MaterialStock'
import ProductStock from '@/pages/kitchen/ProductStock'
import MaterialOrder from '@/pages/kitchen/MaterialOrder'
import KitchenDailyExpense from '@/pages/kitchen/DailyExpense'

import AdminHome from '@/pages/admin/AdminHome'
import ProductManager from '@/pages/admin/ProductManager'
import MaterialManager from '@/pages/admin/MaterialManager'
import StaffManager from '@/pages/admin/StaffManager'
import StoreManager from '@/pages/admin/StoreManager'
import SettlementManager from '@/pages/admin/SettlementManager'
import QRCodePage from '@/pages/admin/QRCodePage'
import ZoneManager from '@/pages/admin/ZoneManager'
import OrderHistory from '@/pages/admin/OrderHistory'
import SettlementHistory from '@/pages/admin/SettlementHistory'
import OrderPricing from '@/pages/admin/OrderPricing'
import WeatherAnalysis from '@/pages/admin/WeatherAnalysis'
import BossDashboard from '@/pages/admin/BossDashboard'
import ProductionSchedule from '@/pages/kitchen/ProductionSchedule'
import PinManager from '@/pages/admin/PinManager'
import AuditLog from '@/pages/admin/AuditLog'
import ExpenseManagement from '@/pages/admin/ExpenseManagement'
import ProfitLoss from '@/pages/admin/ProfitLoss'

function App() {
  useInitStores()

  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="max-w-lg mx-auto min-h-screen" style={{ backgroundColor: 'var(--color-page-bg)' }}>
          <OfflineBanner />
          <Routes>
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/store/lehua" replace />} />

            {/* Store routes — AuthGuard as layout, stays mounted during sub-navigation */}
            <Route element={<AuthGuard requiredRole="store" />}>
              <Route path="/store/:storeId" element={<StoreHome />} />
              <Route path="/store/:storeId/inventory" element={<Inventory />} />
              <Route path="/store/:storeId/settlement" element={<Settlement />} />
              <Route path="/store/:storeId/usage" element={<Usage />} />
              <Route path="/store/:storeId/order" element={<Order />} />
              <Route path="/store/:storeId/receive" element={<Receive />} />
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
        </div>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
