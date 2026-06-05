import { useLocation, Navigate } from "react-router-dom"
import { useAppStore } from "../stores/AppStore"

function AuthRoute({
  children,
  requireAuth = true,
  allowIncompleteSession = false,
  isAuthenticated = useAppStore.getState().isAuthenticated,
  hasServer = useAppStore.getState().hasServer,
  hasLibraries = useAppStore.getState().hasLibraries,
  hasSession = useAppStore.getState().hasSession
}) {
  const location = useLocation()

  console.log(`[AUTH ROUTE] Path: "${location.pathname}" | requireAuth: ${requireAuth} | isAuthenticated: ${isAuthenticated} | hasServer: ${hasServer} | hasLibraries: ${hasLibraries} | hasSession: ${hasSession} | allowIncompleteSession: ${allowIncompleteSession}`)

  // Protected routes
  if (requireAuth) {
    if (!isAuthenticated) {
      console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (Not Authenticated). Redirecting to /login`)
      return <Navigate to="/login" replace />
    }

    // If we are trying to access a fully protected route (like /browse)
    if (!allowIncompleteSession) {
      if (!hasSession) {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No profile session). Redirecting to /user-select`)
        return <Navigate to="/user-select" replace />
      } else if (!hasServer) {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No server selected). Redirecting to /server-select`)
        return <Navigate to="/server-select" replace />
      } else if (!hasLibraries) {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No libraries selected). Redirecting to /library-select`)
        return <Navigate to="/library-select" replace />
      }
    }

    // Enforce linear setup progression if allowIncompleteSession is true
    // If they are on a setup page, ensure they don't skip ahead.
    if (allowIncompleteSession) {
      if (location.pathname === "/server-select" && !hasSession) {
        console.log(`[AUTH ROUTE] Enforcing progression: Missing session for server-select. Redirecting to /user-select`)
        return <Navigate to="/user-select" replace />
      }
      if (location.pathname === "/library-select") {
        if (!hasSession) {
          console.log(`[AUTH ROUTE] Enforcing progression: Missing session for library-select. Redirecting to /user-select`)
          return <Navigate to="/user-select" replace />
        }
        if (!hasServer) {
          console.log(`[AUTH ROUTE] Enforcing progression: Missing server for library-select. Redirecting to /server-select`)
          return <Navigate to="/server-select" replace />
        }
      }
    }

    console.log(`[AUTH ROUTE] Granted protected route "${location.pathname}"`)
    return children
  }

  // Public route (Login page)
  if (isAuthenticated) {
    if (hasSession) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with valid session. Redirecting to /browse`)
      return <Navigate to="/browse" replace />
    }

    if (!hasSession) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with no session. Redirecting to /user-select`)
      return <Navigate to="/user-select" replace />
    } else if (!hasServer) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with session but no server. Redirecting to /server-select`)
      return <Navigate to="/server-select" replace />
    } else if (!hasLibraries) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with session and server, no libraries. Redirecting to /library-select`)
      return <Navigate to="/library-select" replace />
    }
  }

  console.log(`[AUTH ROUTE] Granted public route "${location.pathname}"`)
  return children
}

export default AuthRoute