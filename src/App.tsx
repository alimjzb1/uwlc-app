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
import Invoices from './pages/Invoices';
import { Layout } from './components/layout/Layout';
import Locations from './pages/Locations';
import LocationDetail from './pages/LocationDetail';
import Integrations from './pages/Integrations';
import Users from './pages/Users';
import Settings from './pages/Settings';
import ResetPassword from './pages/ResetPassword';


import { ThemeProvider } from "@/components/theme-provider"

import { Toaster } from "@/components/ui/sonner";

function App() {
  return (
    <Router>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/inventory" element={<ProtectedRoute module="inventory" action="read"><Inventory /></ProtectedRoute>} />
            <Route path="/inventory/:id" element={<ProtectedRoute module="inventory" action="read"><ProductDetail /></ProtectedRoute>} />
            <Route path="/inventory/shopify/:id" element={<ProtectedRoute module="inventory" action="read"><ShopifyProductDetail /></ProtectedRoute>} />
            <Route path="/orders" element={<ProtectedRoute module="orders" action="read"><Orders /></ProtectedRoute>} />
            <Route path="/orders/:id" element={<ProtectedRoute module="orders" action="read"><OrderDetail /></ProtectedRoute>} />
            <Route path="/customers" element={<ProtectedRoute module="customers" action="read"><Customers /></ProtectedRoute>} />
            <Route path="/customers/:id" element={<ProtectedRoute module="customers" action="read"><CustomerDetail /></ProtectedRoute>} />
            <Route path="/delivery" element={<ProtectedRoute module="delivery" action="read"><Delivery /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute module="invoices" action="read"><Invoices /></ProtectedRoute>} />
            <Route path="/locations" element={<ProtectedRoute module="locations" action="read"><Locations /></ProtectedRoute>} />
            <Route path="/locations/:id" element={<ProtectedRoute module="locations" action="read"><LocationDetail /></ProtectedRoute>} />
            <Route path="/integrations" element={<ProtectedRoute requireAdmin><Integrations /></ProtectedRoute>} />
            <Route path="/users" element={<ProtectedRoute requireAdmin><Users /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute module="settings" action="read"><Settings /></ProtectedRoute>} />
          </Route>

        </Routes>
        <Toaster />
      </AuthProvider>
      </ThemeProvider>
    </Router>
  );
}
export default App;
