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

import KitchenHome from '@/pages/kitchen/KitchenHome'
import OrderSummary from '@/pages/kitchen/OrderSummary'
import Shipment from '@/pages/kitchen/Shipment'
import MaterialStock from '@/pages/kitchen/MaterialStock'
import ProductStock from '@/pages/kitchen/ProductStock'
import MaterialOrder from '@/pages/kitchen/MaterialOrder'

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

            {/* Store routes */}
            <Route path="/store/:storeId" element={<AuthGuard requiredRole="store"><StoreHome /></AuthGuard>} />
            <Route path="/store/:storeId/inventory" element={<AuthGuard requiredRole="store"><Inventory /></AuthGuard>} />
            <Route path="/store/:storeId/settlement" element={<AuthGuard requiredRole="store"><Settlement /></AuthGuard>} />
            <Route path="/store/:storeId/usage" element={<AuthGuard requiredRole="store"><Usage /></AuthGuard>} />
            <Route path="/store/:storeId/order" element={<AuthGuard requiredRole="store"><Order /></AuthGuard>} />
            <Route path="/store/:storeId/receive" element={<AuthGuard requiredRole="store"><Receive /></AuthGuard>} />

            {/* Kitchen routes */}
            <Route path="/kitchen" element={<AuthGuard requiredRole="kitchen"><KitchenHome /></AuthGuard>} />
            <Route path="/kitchen/orders" element={<AuthGuard requiredRole="kitchen"><OrderSummary /></AuthGuard>} />
            <Route path="/kitchen/shipments" element={<AuthGuard requiredRole="kitchen"><Shipment /></AuthGuard>} />
            <Route path="/kitchen/materials" element={<AuthGuard requiredRole="kitchen"><MaterialStock /></AuthGuard>} />
            <Route path="/kitchen/products" element={<AuthGuard requiredRole="kitchen"><ProductStock /></AuthGuard>} />
            <Route path="/kitchen/material-orders" element={<AuthGuard requiredRole="kitchen"><MaterialOrder /></AuthGuard>} />
            <Route path="/kitchen/schedule" element={<AuthGuard requiredRole="kitchen"><ProductionSchedule /></AuthGuard>} />

            {/* Admin routes */}
            <Route path="/admin" element={<AuthGuard requiredRole="admin"><AdminHome /></AuthGuard>} />
            <Route path="/admin/dashboard" element={<AuthGuard requiredRole="admin"><BossDashboard /></AuthGuard>} />
            <Route path="/admin/products" element={<AuthGuard requiredRole="admin"><ProductManager /></AuthGuard>} />
            <Route path="/admin/materials" element={<AuthGuard requiredRole="admin"><MaterialManager /></AuthGuard>} />
            <Route path="/admin/staff" element={<AuthGuard requiredRole="admin"><StaffManager /></AuthGuard>} />
            <Route path="/admin/stores" element={<AuthGuard requiredRole="admin"><StoreManager /></AuthGuard>} />
            <Route path="/admin/settlement-fields" element={<AuthGuard requiredRole="admin"><SettlementManager /></AuthGuard>} />
            <Route path="/admin/qrcode" element={<AuthGuard requiredRole="admin"><QRCodePage /></AuthGuard>} />
            <Route path="/admin/zones" element={<AuthGuard requiredRole="admin"><ZoneManager /></AuthGuard>} />
            <Route path="/admin/order-history" element={<AuthGuard requiredRole="admin"><OrderHistory /></AuthGuard>} />
            <Route path="/admin/settlement-history" element={<AuthGuard requiredRole="admin"><SettlementHistory /></AuthGuard>} />
            <Route path="/admin/order-pricing" element={<AuthGuard requiredRole="admin"><OrderPricing /></AuthGuard>} />
            <Route path="/admin/weather-analysis" element={<AuthGuard requiredRole="admin"><WeatherAnalysis /></AuthGuard>} />
            <Route path="/admin/pins" element={<AuthGuard requiredRole="admin"><PinManager /></AuthGuard>} />
            <Route path="/admin/audit" element={<AuthGuard requiredRole="admin"><AuditLog /></AuthGuard>} />
          </Routes>
        </div>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
