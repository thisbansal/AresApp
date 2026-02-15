import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { WebOSInputProvider } from './services/navigation/WebOSInputProvider'
import { EdgeScrollTriggers } from './components/navigational/EdgeScrollTriggers'
import { KeyboardHandler } from './components/navigational/KeyboardHandler'
import { getMainToken, initialiseDatabase } from './services/luna/tokenStorage'
import { hasCompleteSession } from './utils/appSettings'

import AuthRoute from './pages/Auth'
import LoginPage from './pages/LoginPage'
import UserSelectPage from './pages/UserSelectPage'
import HomePage from './pages/HomePage'
import ServerSelectPage from './pages/ServerSelectPage'

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
        <div>Loading...</div>
      </div>
    )
  }



  return (
    <WebOSInputProvider>
      <KeyboardHandler />
      <EdgeScrollTriggers />

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
                allowIncompleteSession={true}  // 👈 NEW PROP
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
                allowIncompleteSession={true}  // 👈 NEW PROP
              >
                <UserSelectPage />
              </AuthRoute>
            }
          />

          <Route
            path="/home"
            element={
              <AuthRoute
                requireAuth={true}
                isAuthenticated={authState.isAuthenticated}
                hasSession={authState.hasSession}
              >
                <HomePage />
              </AuthRoute>
            }
          />

          <Route
            path="/"
            element={
              <Navigate
                to={authState.isAuthenticated && authState.hasSession ? "/home" : "/login"}
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