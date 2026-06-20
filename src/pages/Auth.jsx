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

  // Define the strict sequential order of onboarding steps
  const onboardingSteps = [
    { path: '/login', isComplete: activeIsAuthenticated },
    { path: '/user-select', isComplete: activeHasSession },
    { path: '/server-select', isComplete: activeHasServer },
    { path: '/library-select', isComplete: activeHasLibraries }
  ]

  const targetStepIndex = onboardingSteps.findIndex(step => step.path === location.pathname)
  const requiredStepIndex = onboardingSteps.findIndex(step => !step.isComplete)

  console.log(`[AUTH ROUTE] Path: "${location.pathname}" | targetIdx: ${targetStepIndex} | requiredIdx: ${requiredStepIndex}`)

  // Protected routes
  if (requireAuth) {
    if (!activeIsAuthenticated) {
      console.log(`[AUTH ROUTE] Denied protected route "${location.pathname}" (Not Authenticated). Redirecting to /login`)
      return <Navigate to="/login" replace />
    }

    if (!allowIncompleteSession) {
      // For fully protected routes (e.g. /browse), all steps must be complete
      if (requiredStepIndex !== -1) {
        const targetPath = onboardingSteps[requiredStepIndex].path
        console.log(`[AUTH ROUTE] Denied fully protected route. Redirecting to ${targetPath}`)
        return <Navigate to={targetPath} replace />
      }
    } else {
      // For onboarding routes, enforce linear progression to prevent skipping ahead
      if (targetStepIndex !== -1 && requiredStepIndex !== -1 && targetStepIndex > requiredStepIndex) {
        const targetPath = onboardingSteps[requiredStepIndex].path
        console.log(`[AUTH ROUTE] Enforcing progression. Redirecting to ${targetPath}`)
        return <Navigate to={targetPath} replace />
      }
    }

    console.log(`[AUTH ROUTE] Granted protected route "${location.pathname}"`)
    return children
  }

  // Public route (e.g., /login)
  if (activeIsAuthenticated) {
    // If user is authenticated but hits a public route, send them to their next required step or browse
    const redirectTo = requiredStepIndex !== -1 ? onboardingSteps[requiredStepIndex].path : '/browse'
    console.log(`[AUTH ROUTE] Public route accessed by authenticated user. Redirecting to ${redirectTo}`)
    return <Navigate to={redirectTo} replace />
  }

  console.log(`[AUTH ROUTE] Granted public route "${location.pathname}"`)
  return children
}

export default AuthRoute