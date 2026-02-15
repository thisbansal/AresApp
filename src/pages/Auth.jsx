import { useLocation, Navigate } from "react-router-dom"

function AuthRoute({
  children,
  requireAuth = true,
  isAuthenticated,
  hasSession,
  allowIncompleteSession = false  // 👈 NEW PROP
}) {
  const location = useLocation()

  // Protected routes
  if (requireAuth) {
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />
    }

    // Allow incomplete session for setup pages (server-select, user-select)
    if (!hasSession && !allowIncompleteSession) {
      return <Navigate to="/server-select" replace />
    }

    return children
  }

  // Public route (Login page)
  if (isAuthenticated && hasSession) {
    return <Navigate to="/home" replace />
  }

  if (isAuthenticated && !hasSession) {
    return <Navigate to="/server-select" replace />
  }

  return children
}

export default AuthRoute