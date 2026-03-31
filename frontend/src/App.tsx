import { Navigate, Route, Routes } from 'react-router-dom'

import ProtectedRoute from './auth/ProtectedRoute'
import { useAuth } from './auth/AuthContext'
import { getDefaultAuthenticatedRoute } from './auth/access'
import DashboardPage from './pages/DashboardPage'
import ClientsPage from './pages/ClientsPage'
import ApprovalsPage from './pages/ApprovalsPage'
import ExpensesPage from './pages/ExpensesPage'
import InventoryPage from './pages/InventoryPage'
import LoginPage from './pages/LoginPage'
import NotificationsPage from './pages/NotificationsPage'
import OrderDetailPage from './pages/OrderDetailPage'
import OrdersPage from './pages/OrdersPage'
import PaymentsPage from './pages/PaymentsPage'
import ReceptionPage from './pages/ReceptionPage'
import ReportsPage from './pages/ReportsPage'
import SettingsPage from './pages/SettingsPage'
import StaffPage from './pages/StaffPage'
import StaffDetailPage from './pages/StaffDetailPage'
import MyTasksPage from './pages/MyTasksPage'

function HomeRedirect() {
  const { auth } = useAuth()
  return <Navigate to={auth ? getDefaultAuthenticatedRoute(auth) : '/login'} replace />
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<HomeRedirect />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute requiredPermissions={['report.read']}>
            <DashboardPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reception"
        element={
          <ProtectedRoute requiredPermissions={['order.create']}>
            <ReceptionPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders"
        element={
          <ProtectedRoute requiredPermissions={['order.read']}>
            <OrdersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/notifications"
        element={
          <ProtectedRoute requiredPermissions={['order.read']}>
            <NotificationsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/clients"
        element={
          <ProtectedRoute requiredPermissions={['order.read']}>
            <ClientsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/my-tasks"
        element={
          <ProtectedRoute requiredPermissions={['task.update']}>
            <MyTasksPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff"
        element={
          <ProtectedRoute requiredPermissions={['staff.read']}>
            <StaffPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/staff/:id"
        element={
          <ProtectedRoute requiredPermissions={['staff.read']}>
            <StaffDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute requiredPermissions={['system.settings', 'staff.manage']}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/approvals"
        element={
          <ProtectedRoute requiredPermissions={['order.read']}>
            <ApprovalsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute requiredPermissions={['report.read']}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/orders/:id"
        element={
          <ProtectedRoute requiredPermissions={['order.read']}>
            <OrderDetailPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/inventory"
        element={
          <ProtectedRoute requiredPermissions={['inventory.read']}>
            <InventoryPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/payments"
        element={
          <ProtectedRoute requiredPermissions={['payment.read', 'payment.create', 'expense.create']}>
            <PaymentsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/expenses"
        element={
          <ProtectedRoute requiredPermissions={['expense.create']}>
            <ExpensesPage />
          </ProtectedRoute>
        }
      />
    </Routes>
  )
}

export default App
