import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { WebOSInputProvider } from './services/navigation/WebOSInputProvider'
import { EdgeScrollTriggers } from './components/navigational/EdgeScrollTriggers'
import { KeyboardHandler } from './components/navigational/KeyboardHandler'
import { SplashScreen } from './components/navigational/Splashscreen'
import { getMainToken } from './services/luna/tokenStorage'
import { hasCompleteSession } from './utils/appSettings'
import { getSetting, APP_KEYS } from './services/luna/settingsStorage'
import { initializeApp } from './services/initializationService'
import { logEnvironment } from './services/Environment/environment'

import LoginPage from './pages/LoginPage'
import UserSelectPage from './pages/UserSelectPage'
import HomePage from './pages/HomePage'
import ServerSelectPage from './pages/ServerSelectPage'

function App() {
  const [appState, setAppState] = useState('checking') // checking, initializing, ready
  const [initProgress, setInitProgress] = useState(0)
  const [initStatus, setInitStatus] = useState('Starting...')
  const [initialData, setInitialData] = useState(null)

  useEffect(() => {
    initializeApplication()
  }, [])

  const initializeApplication = async () => {
    try {
      // Log environment
      logEnvironment()

      // Check if user is logged in and has a complete session
      const token = await getMainToken()
      const canAutoLogin = await hasCompleteSession()

      console.log('[App] Has token:', !!token, 'Can auto-login:', canAutoLogin)

      if (!token) {
        // No token - go to login
        setAppState('ready')
        return
      }

      if (!canAutoLogin) {
        // Has token but needs server/user selection
        setAppState('ready')
        return
      }

      // User is fully logged in - initialize data
      setAppState('initializing')

      const data = await initializeApp((progress) => {
        setInitProgress(progress.progress)
        setInitStatus(progress.status)

        // Handle background updates
        if (progress.dataUpdated && progress.newData) {
          console.log('[App] Background update received')
          setInitialData({
            ...initialData,
            movies: progress.newData
          })
        }
      })

      setInitialData(data)
      setAppState('ready')

    } catch (err) {
      console.error('[App] Initialization failed:', err)
      setAppState('ready') // Show UI anyway, it will handle errors
    }
  }

  // Show splash screen during initialization
  if (appState === 'checking') {
    return <SplashScreen progress={0} status="Starting..." />
  }

  if (appState === 'initializing') {
    return <SplashScreen progress={initProgress} status={initStatus} />
  }

  // App is ready - show normal routing
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
            <AuthRoute requireAuth={true}>
              <ServerSelectPage />
            </AuthRoute>
          } />

          <Route path="/user-select" element={
            <AuthRoute requireAuth={true}>
              <UserSelectPage />
            </AuthRoute>
          } />

          <Route path="/home" element={
            <AuthRoute requireAuth={true}>
              <HomePage initialData={initialData} />
            </AuthRoute>
          } />

          <Route path="/" element={<Navigate to="/home" replace />} />
        </Routes>
      </div>
    </WebOSInputProvider>
  )
}

function AuthRoute({ children, requireAuth = true, redirectTo = '/login' }) {
  const [hasToken, setHasToken] = useState(null)
  const [checking, setChecking] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    checkToken()
  }, [])

  const checkToken = async () => {
    const token = await getMainToken()
    setHasToken(!!token)

    if (requireAuth && !token) {
      navigate('/login', { replace: true })
    } else if (!requireAuth && token) {
      const canAutoLogin = await hasCompleteSession()

      if (canAutoLogin) {
        navigate('/home', { replace: true })
      } else {
        const savedServer = await getSetting(APP_KEYS.PMS_SERVER)
        if (savedServer) {
          navigate('/user-select', { replace: true })
        } else {
          navigate('/server-select', { replace: true })
        }
      }
    } else if (requireAuth && token) {
      const currentPath = window.location.hash.replace('#', '')

      if (currentPath === '/server-select' || currentPath === '/user-select') {
        const canAutoLogin = await hasCompleteSession()

        if (canAutoLogin) {
          navigate('/home', { replace: true })
        } else if (currentPath === '/server-select') {
          const savedServer = await getSetting(APP_KEYS.PMS_SERVER)
          if (savedServer) {
            navigate('/user-select', { replace: true })
          }
        }
      }
    }

    setChecking(false)
  }

  if (checking) {
    return <SplashScreen progress={10} status="Checking authentication..." />
  }

  return (requireAuth && hasToken) || (!requireAuth && !hasToken) ? children : null
}

export default App