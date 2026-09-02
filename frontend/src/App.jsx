import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import PolarMap from './pages/PolarMap'
import Stations from './pages/Stations'
import Inventory from './pages/Inventory'
import Shipments from './pages/Shipments'
import QrTracking from './pages/QrTracking'
import Alerts from './pages/Alerts'
import Reports from './pages/Reports'
import Users from './pages/Users'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="map" element={<PolarMap />} />
            <Route path="stations" element={<Stations />} />
            <Route path="inventory" element={<Inventory />} />
            <Route path="shipments" element={<Shipments />} />
            <Route path="qr" element={<QrTracking />} />
            <Route path="alerts" element={<Alerts />} />
            <Route path="reports" element={<Reports />} />
            <Route path="users" element={<Users />} />
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

