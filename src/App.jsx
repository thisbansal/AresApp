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

function ProtectedRoute({ children }) {
  const [hasToken, setHasToken] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    checkToken()
  }, [])

  const checkToken = async () => {
    const token = await getToken()
    setHasToken(!!token)
    if (!token) {
      navigate('/login')
    }
  }

  if (hasToken === null) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '48px', color: '#e8eaed' }}>Loading...</div>

  return hasToken ? children : null
}

function LoginRoute({ children }) {
  const [hasToken, setHasToken] = useState(null)
  const navigate = useNavigate()

  useEffect(() => {
    checkToken()
  }, [])

  const checkToken = async () => {
    const token = await getToken()
    setHasToken(!!token)
    if (token) {
      // Already logged in, redirect to user select
      navigate('/user-select', { replace: true })
    }
  }

  if (hasToken === null) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontSize: '48px', color: '#e8eaed' }}>Loading...</div>

  return !hasToken ? children : null
}

function App() {
  return (
    <WebOSInputProvider>
      <KeyboardHandler />
      <EdgeScrollTriggers />

      <div className="app">
        <Routes>
          <Route path="/login" element={
            <LoginRoute>
              <LoginPage />
            </LoginRoute>
          } />
          <Route path="/server-select" element={
            <ProtectedRoute>
              <ServerSelectPage />
            </ProtectedRoute>
          } />
          <Route path="/user-select" element={
            <ProtectedRoute>
              <UserSelectPage />
            </ProtectedRoute>
          } />
          <Route path="/home" element={
            <ProtectedRoute>
              <HomePage />
            </ProtectedRoute>
          } />
          <Route path="/" element={<Navigate to="/server-select" replace />} />
        </Routes>
      </div>
    </WebOSInputProvider>
  )
}

export default App