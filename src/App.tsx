import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './components/auth/AuthProvider';
import { ProtectedRoute } from './components/auth/ProtectedRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Orders from './pages/Orders';
import OrderDetail from './pages/OrderDetail';
import Inventory from './pages/Inventory';
import ProductDetail from './pages/ProductDetail'; // Added import
import ShopifyProductDetail from './pages/ShopifyProductDetail';
import Customers from './pages/Customers';
import CustomerDetail from './pages/CustomerDetail';
import Delivery from './pages/Delivery';
import { Layout } from './components/layout/Layout';
import Locations from './pages/Locations';
import LocationDetail from './pages/LocationDetail';
import Integrations from './pages/Integrations';
import Users from './pages/Users';


import { ThemeProvider } from "@/components/theme-provider"

import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <Router>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<ProtectedRoute allowedRoles={['admin', 'employee', 'viewer']}><Inventory /></ProtectedRoute>} />
            <Route path="/inventory/:id" element={<ProtectedRoute allowedRoles={['admin', 'employee', 'viewer']}><ProductDetail /></ProtectedRoute>} />
            <Route path="/inventory/shopify/:id" element={<ProtectedRoute allowedRoles={['admin', 'employee', 'viewer']}><ShopifyProductDetail /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute allowedRoles={['admin', 'employee', 'viewer']}><Orders /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute allowedRoles={['admin', 'employee', 'viewer']}><OrderDetail /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute allowedRoles={['admin', 'employee', 'viewer']}><Customers /></ProtectedRoute>} />
            <Route path="/customers/:id" element={<ProtectedRoute allowedRoles={['admin', 'employee', 'viewer']}><CustomerDetail /></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute allowedRoles={['admin', 'employee', 'viewer']}><Delivery /></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute requireAdmin><Locations /></ProtectedRoute>} />
            <Route path="/locations/:id" element={<ProtectedRoute requireAdmin><LocationDetail /></ProtectedRoute>} />
            <Route path="/integrations" element={<ProtectedRoute requireAdmin><Integrations /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
          </Route>

        </Routes>
        <Toaster />
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
export default App;
