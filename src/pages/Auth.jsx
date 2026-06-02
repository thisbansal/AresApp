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

    // We no longer block setup routes when hasSession is true, 
    // to allow users to navigate to /library-select from Settings, 
    // or /server-select to switch servers.

    // If session is NOT complete, and we are not on setup pages
    if (!hasSession && !allowIncompleteSession) {
      if (!hasServer) {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No server selected). Redirecting to /server-select`)
        return <Navigate to="/server-select" replace />
      } else if (!hasLibraries) {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (No libraries selected). Redirecting to /library-select`)
        return <Navigate to="/library-select" replace />
      } else {
        console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (Server & Libraries exist, no profile session). Redirecting to /user-select`)
        return <Navigate to="/user-select" replace />
      }
    }

    // Enforce linear setup progression if allowIncompleteSession is true
    if (!hasSession && allowIncompleteSession) {
      if (location.pathname === "/library-select" && !hasServer) {
        console.log(`[AUTH ROUTE] Enforcing progression: Missing server for library-select. Redirecting to /server-select`)
        return <Navigate to="/server-select" replace />
      }
      if (location.pathname === "/user-select") {
        if (!hasServer) {
          console.log(`[AUTH ROUTE] Enforcing progression: Missing server for user-select. Redirecting to /server-select`)
          return <Navigate to="/server-select" replace />
        }
        if (!hasLibraries) {
          console.log(`[AUTH ROUTE] Enforcing progression: Missing libraries for user-select. Redirecting to /library-select`)
          return <Navigate to="/library-select" replace />
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

    if (!hasServer) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with no server. Redirecting to /server-select`)
      return <Navigate to="/server-select" replace />
    } else if (!hasLibraries) {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with server, no libraries. Redirecting to /library-select`)
      return <Navigate to="/library-select" replace />
    } else {
      console.log(`[AUTH ROUTE] Public route "${location.pathname}" accessed with server & libraries, no profile session. Redirecting to /user-select`)
      return <Navigate to="/user-select" replace />
    }
  }

  console.log(`[AUTH ROUTE] Granted public route "${location.pathname}"`)
  return children
}

export default AuthRoute