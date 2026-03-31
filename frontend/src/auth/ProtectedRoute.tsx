import type { ReactElement } from 'react'
import { Navigate, useLocation } from 'react-router-dom'

import { useAuth } from './AuthContext'
import { getDefaultAuthenticatedRoute, hasAnyPermission } from './access'

type ProtectedRouteProps = {
  children: ReactElement
  requiredPermissions?: string[]
}

function ProtectedRoute({
  children,
  requiredPermissions = [],
}: ProtectedRouteProps) {
  const { auth, isBootstrapping } = useAuth()
  const location = useLocation()

  if (isBootstrapping) {
    return <div className="screen-loader">Yuklanmoqda...</div>
  }

  if (!auth) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (
    requiredPermissions.length &&
    !hasAnyPermission(auth, requiredPermissions)
  ) {
    return (
      <Navigate
        to={getDefaultAuthenticatedRoute(auth)}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return children
}

export default ProtectedRoute
