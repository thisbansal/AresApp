import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { WebOSInputProvider } from './services/navigation/WebOSInputProvider'
import {EdgeScrollTriggers} from './components/navigational/EdgeScrollTriggers'
import { KeyboardHandler } from './components/navigational/KeyboardHandler'
import { getToken } from './services/configurator/lunaTokenService'
import LoginPage from './pages/LoginPage'
import UserSelectPage from './pages/UserSelectPage'
import HomePage from './pages/HomePage'
import ServerSelectPage from './pages/ServerSelectPage'

function AuthRoute({ children, requireAuth = true, redirectTo = '/login' }) {
  const [hasToken, setHasToken] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    checkToken()
  }, [])

  const checkToken = async () => {
    const token = await getToken()
    setHasToken(!!token)

    // If requireAuth=true and no token → redirect to login
    // If requireAuth=false and has token → redirect away from login
    if (requireAuth && !token) {
      navigate('/login', { replace: true })
    } else if (!requireAuth && token) {
      navigate(redirectTo, { replace: true })
    }
  }

  if (hasToken === null) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '48px', color: '#e8eaed' }}>Loading...</div>
  }

  // Show children only if auth requirement matches
  return (requireAuth && hasToken) || (!requireAuth && !hasToken) ? children : null
}

function App() {
  return (
    <WebOSInputProvider>
      <KeyboardHandler />
      <EdgeScrollTriggers />

      <div className="app">
        <Routes>
          <Route path="/login" element={
            <AuthRoute requireAuth={false} redirectTo='/server-select'>
              <LoginPage />
            </AuthRoute>
          } />
          <Route path="/server-select" element={
            <AuthRoute requireAuth={true} redirectTo='/user-select'>
              <ServerSelectPage />
            </AuthRoute>
          } />
          <Route path="/user-select" element={
            <AuthRoute requireAuth={true} redirectTo='/home'>
              <UserSelectPage />
            </AuthRoute>
          } />
          <Route path="/home" element={
            <AuthRoute requireAuth={true}>
              <HomePage />
            </AuthRoute>
          } />
          <Route path="/" element={<Navigate to="/server-select" replace />} />
        </Routes>
      </div>
    </WebOSInputProvider>
  )
}

export default App