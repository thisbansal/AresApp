import { useLocation, Navigate } from "react-router-dom"

function AuthRoute({
  children,
  requireAuth = true,
  isAuthenticated,
  hasServer = false,
  hasSession,
  allowIncompleteSession = false
}) {
  const location = useLocation()

  console.log(`[AUTH ROUTE] Path: "${location.pathname}" | requireAuth: ${requireAuth} | isAuthenticated: ${isAuthenticated} | hasServer: ${hasServer} | hasSession: ${hasSession} | allowIncompleteSession: ${allowIncompleteSession}`)

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

    // If session is NOT complete, and we are not on setup pages
    if (!hasSession && !allowIncompleteSession) {
      if (!hasServer) {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No server selected). Redirecting to /server-select`)
        return <Navigate to="/server-select" replace />
      } else {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (Server exists, no profile session). Redirecting to /user-select`)
        return <Navigate to="/user-select" replace />
      }
    }

    // If session is NOT complete, but we are on setup pages
    // if (!hasSession && allowIncompleteSession) {
    //   // If server is not selected but trying to access user-select
    //   if (!hasServer && location.pathname === "/user-select") {
    //     console.log(`[AUTH ROUTE] Denied user-select setup page (No server selected). Redirecting to /server-select`)
    //     return <Navigate to="/server-select" replace />
    //   }
    // }

    console.log(`[AUTH ROUTE] Granted protected route "${location.pathname}"`)
    return children
  }

  // Public route (Login page)
  if (isAuthenticated) {
    if (hasSession) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with valid session. Redirecting to /browse`)
      return <Navigate to="/browse" replace />
    }

    if (!hasServer) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with no server. Redirecting to /server-select`)
      return <Navigate to="/server-select" replace />
    } else {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with server, no profile session. Redirecting to /user-select`)
      return <Navigate to="/user-select" replace />
    }
  }

  console.log(`[AUTH ROUTE] Granted public route "${location.pathname}"`)
  return children
}

export default AuthRoute