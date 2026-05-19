import { useLocation, Navigate } from "react-router-dom"

function AuthRoute({
  children,
  requireAuth = true,
  isAuthenticated,
  hasSession,
  allowIncompleteSession = false
}) {
  const location = useLocation()

  console.log(`[AUTH ROUTE] Path: "${location.pathname}" | requireAuth: ${requireAuth} | isAuthenticated: ${isAuthenticated} | hasSession: ${hasSession} | allowIncompleteSession: ${allowIncompleteSession}`)

  // Protected routes
  if (requireAuth) {
    if (!isAuthenticated) {
      console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (Not Authenticated). Redirecting to /login`)
      return <Navigate to="/login" replace />
    }

    // If session is complete, do not allow setup routes
    if (hasSession && (location.pathname === "/server-select" || location.pathname === "/user-select")) {
      console.log(`[AUTH ROUTE] Setup route "${location.pathname}" accessed with complete session. Redirecting to /browse`)
      return <Navigate to="/browse" replace />
    }

    // Allow incomplete session for setup pages (server-select, user-select)
    if (!hasSession && !allowIncompleteSession) {
      console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No complete profile session). Redirecting to /server-select`)
      return <Navigate to="/server-select" replace />
    }

    console.log(`[AUTH ROUTE] Granted protected route "${location.pathname}"`)
    return children
  }

  // Public route (Login page)
  if (isAuthenticated && hasSession) {
    console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with valid session. Redirecting to /browse`)
    return <Navigate to="/browse" replace />
  }

  if (isAuthenticated && !hasSession) {
    console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with incomplete session. Redirecting to /server-select`)
    return <Navigate to="/server-select" replace />
  }

  console.log(`[AUTH ROUTE] Granted public route "${location.pathname}"`)
  return children
}

export default AuthRoute