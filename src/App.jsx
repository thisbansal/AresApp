import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { WebOSInputProvider } from './services/navigation/WebOSInputProvider'
import { EdgeScrollTriggers } from './components/navigational/EdgeScrollTriggers'
import { KeyboardHandler } from './components/navigational/KeyboardHandler'
import { getMainToken, initialiseDatabase } from './services/luna/tokenStorage'
import { hasCompleteSession } from './utils/appSettings'
import { SystemToaster } from './components/navigational/SystemToaster'

import AuthRoute from './pages/Auth'
import LoginPage from './routes/LoginPage'
import UserSelectPage from './routes/UserSelectPage'
import ContentBrowserPage from './routes/ContentBrowserPage'
import ServerSelectPage from './routes/ServerSelectPage'
import MediaDetailsPage from './routes/MediaDetailsPage'
import PlayerPage from './routes/PlayerPage'

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

function App() {
  const [authState, setAuthState] = useState({
    isAuthenticated: false,
    hasSession: false,
    isLoading: true
  })


  useEffect(() => {
    initialiseDatabase()
    initialiseApplication()
  }, [])

  const initialiseApplication = async () => {
    try {
      const token = await getMainToken()

      const sessionComplete = await hasCompleteSession()

      setAuthState({
        isAuthenticated: !!token,
        hasSession: sessionComplete,
        isLoading: false
      })

    } catch (err) {
      setAuthState({
        isAuthenticated: false,
        hasSession: false,
        isLoading: false
      })
    }
  }


  // Show loading state while checking auth
  if (authState.isLoading) {
    return (
      <div className="app loading" style={{ padding: '20px', color: 'white' }}>
        <div></div>
      </div>
    )
  }



  return (
    <WebOSInputProvider>
      <KeyboardHandler />
      <EdgeScrollTriggers />
      <SystemToaster />

      <div className="app">
        <Routes>
          <Route
            path="/login"
            element={
              <AuthRoute
                requireAuth={false}
                isAuthenticated={authState.isAuthenticated}
                hasSession={authState.hasSession}
              >
                <LoginPage />
              </AuthRoute>
            }
          />

          <Route
            path="/server-select"
            element={
              <AuthRoute
                requireAuth={true}
                isAuthenticated={authState.isAuthenticated}
                hasSession={authState.hasSession}
                allowIncompleteSession={true}  // NEW PROP
              >
                <ServerSelectPage />
              </AuthRoute>
            }
          />

          <Route
            path="/user-select"
            element={
              <AuthRoute
                requireAuth={true}
                isAuthenticated={authState.isAuthenticated}
                hasSession={authState.hasSession}
                allowIncompleteSession={true}  // NEW PROP
              >
                <UserSelectPage />
              </AuthRoute>
            }
          />

          <Route
            path="/browse"
            element={
              <AuthRoute
                requireAuth={true}
                isAuthenticated={authState.isAuthenticated}
                hasSession={authState.hasSession}
              >
                <ContentBrowserPage />
              </AuthRoute>
            }
          />

          <Route
            path="/details/:ratingKey"
            element={
              <AuthRoute
                requireAuth={true}
                isAuthenticated={authState.isAuthenticated}
                hasSession={authState.hasSession}
              >
                <MediaDetailsPage />
              </AuthRoute>
            }
          />

          <Route
            path="/play/:ratingKey"
            element={
              <AuthRoute
                requireAuth={true}
                isAuthenticated={authState.isAuthenticated}
                hasSession={authState.hasSession}
              >
                <PlayerPage />
              </AuthRoute>
            }
          />

          <Route
            path="/"
            element={
              <Navigate
                to={authState.isAuthenticated && authState.hasSession ? "/browse" : "/login"}
                replace
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </WebOSInputProvider>
  )
}

export default App