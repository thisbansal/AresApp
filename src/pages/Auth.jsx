import { useLocation, Navigate } from "react-router-dom"
import { useAppStore } from "../stores/AppStore"

function AuthRoute({
  children,
  requireAuth = true,
  allowIncompleteSession = false,
  isAuthenticated,
  hasServer,
  hasLibraries,
  hasSession
}) {
  const location = useLocation()
  const store = useAppStore()

  const activeIsAuthenticated = isAuthenticated !== undefined ? isAuthenticated : store.isAuthenticated
  const activeHasServer = hasServer !== undefined ? hasServer : store.hasServer
  const activeHasLibraries = hasLibraries !== undefined ? hasLibraries : store.hasLibraries
  const activeHasSession = hasSession !== undefined ? hasSession : store.hasSession

  console.log(`[AUTH ROUTE] Path: "${location.pathname}" | requireAuth: ${requireAuth} | isAuthenticated: ${activeIsAuthenticated} | hasServer: ${activeHasServer} | hasLibraries: ${activeHasLibraries} | hasSession: ${activeHasSession} | allowIncompleteSession: ${allowIncompleteSession}`)

  // Protected routes
  if (requireAuth) {
    if (!activeIsAuthenticated) {
      console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (Not Authenticated). Redirecting to /login`)
      return <Navigate to="/login" replace />
    }

    // If we are trying to access a fully protected route (like /browse)
    if (!allowIncompleteSession) {
      if (!activeHasSession) {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No profile session). Redirecting to /user-select`)
        return <Navigate to="/user-select" replace />
      } else if (!activeHasServer) {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No server selected). Redirecting to /server-select`)
        return <Navigate to="/server-select" replace />
      } else if (!activeHasLibraries) {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No libraries selected). Redirecting to /library-select`)
        return <Navigate to="/library-select" replace />
      }
    }

    // Enforce linear setup progression if allowIncompleteSession is true
    // If they are on a setup page, ensure they don't skip ahead.
    if (allowIncompleteSession) {
      if (location.pathname === "/server-select" && !activeHasSession) {
        console.log(`[AUTH ROUTE] Enforcing progression: Missing session for server-select. Redirecting to /user-select`)
        return <Navigate to="/user-select" replace />
      }
      if (location.pathname === "/library-select") {
        if (!activeHasSession) {
          console.log(`[AUTH ROUTE] Enforcing progression: Missing session for library-select. Redirecting to /user-select`)
          return <Navigate to="/user-select" replace />
        }
        if (!activeHasServer) {
          console.log(`[AUTH ROUTE] Enforcing progression: Missing server for library-select. Redirecting to /server-select`)
          return <Navigate to="/server-select" replace />
        }
      }
    }

    console.log(`[AUTH ROUTE] Granted protected route "${location.pathname}"`)
    return children
  }

  // Public route (Login page)
  if (activeIsAuthenticated) {
    if (activeHasSession) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with valid session. Redirecting to /browse`)
      return <Navigate to="/browse" replace />
    }

    if (!activeHasSession) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with no session. Redirecting to /user-select`)
      return <Navigate to="/user-select" replace />
    } else if (!activeHasServer) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with session but no server. Redirecting to /server-select`)
      return <Navigate to="/server-select" replace />
    } else if (!activeHasLibraries) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with session and server, no libraries. Redirecting to /library-select`)
      return <Navigate to="/library-select" replace />
    }
  }

  console.log(`[AUTH ROUTE] Granted public route "${location.pathname}"`)
  return children
}

export default AuthRoute