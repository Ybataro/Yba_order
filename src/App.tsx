import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { ToastProvider } from '@/components/Toast'
import { useInitStores } from '@/hooks/useInitStores'

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

function App() {
  useInitStores()

  return (
    <BrowserRouter>
      <ToastProvider>
        <div className="max-w-lg mx-auto min-h-screen" style={{ backgroundColor: 'var(--color-page-bg)' }}>
          <Routes>
            {/* Default redirect */}
            <Route path="/" element={<Navigate to="/store/lehua" replace />} />

            {/* Store routes */}
            <Route path="/store/:storeId" element={<StoreHome />} />
            <Route path="/store/:storeId/inventory" element={<Inventory />} />
            <Route path="/store/:storeId/settlement" element={<Settlement />} />
            <Route path="/store/:storeId/usage" element={<Usage />} />
            <Route path="/store/:storeId/order" element={<Order />} />
            <Route path="/store/:storeId/receive" element={<Receive />} />

            {/* Kitchen routes */}
            <Route path="/kitchen" element={<KitchenHome />} />
            <Route path="/kitchen/orders" element={<OrderSummary />} />
            <Route path="/kitchen/shipments" element={<Shipment />} />
            <Route path="/kitchen/materials" element={<MaterialStock />} />
            <Route path="/kitchen/products" element={<ProductStock />} />
            <Route path="/kitchen/material-orders" element={<MaterialOrder />} />

            {/* Admin routes */}
            <Route path="/admin" element={<AdminHome />} />
            <Route path="/admin/products" element={<ProductManager />} />
            <Route path="/admin/materials" element={<MaterialManager />} />
            <Route path="/admin/staff" element={<StaffManager />} />
            <Route path="/admin/stores" element={<StoreManager />} />
            <Route path="/admin/settlement-fields" element={<SettlementManager />} />
            <Route path="/admin/qrcode" element={<QRCodePage />} />
            <Route path="/admin/zones" element={<ZoneManager />} />
            <Route path="/admin/order-history" element={<OrderHistory />} />
          </Routes>
        </div>
      </ToastProvider>
    </BrowserRouter>
  )
}

export default App
