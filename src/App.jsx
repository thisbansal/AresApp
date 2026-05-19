import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { WebOSInputProvider } from './services/navigation/WebOSInputProvider'
import { EdgeScrollTriggers } from './components/navigational/EdgeScrollTriggers'
import { KeyboardHandler } from './components/navigational/KeyboardHandler'
import { getMainToken, initialiseDatabase } from './services/luna/tokenStorage'
import { hasCompleteSession } from './utils/appSettings'
import { SystemToaster } from './components/navigational/SystemToaster'
import { useServerStore } from './stores/serverStore'
import { plexBridge } from './services/plex/plexBridge'

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

  const isOnline = useServerStore(state => state.isOnline)

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

  // Periodic Health Pings check to keep connection state healthy
  useEffect(() => {
    if (!authState.isAuthenticated || !authState.hasSession) return

    // Trigger initial ping once authenticated
    plexBridge.ping()

    // 30 seconds interval for network connectivity checking
    const intervalId = setInterval(() => {
      plexBridge.ping()
    }, 30000)

    return () => clearInterval(intervalId)
  }, [authState.isAuthenticated, authState.hasSession])

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
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: scale(0.98); }
          to { opacity: 1; transform: scale(1); }
        }
        @keyframes pulse {
          0% { transform: scale(0.95); opacity: 0.15; }
          50% { transform: scale(1.1); opacity: 0.3; }
          100% { transform: scale(0.95); opacity: 0.15; }
        }
      `}</style>

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
                allowIncompleteSession={true}
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
                allowIncompleteSession={true}
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

      {/* Modern, glassmorphic Offline recovery modal */}
      {!isOnline && (
        <div style={styles.offlineOverlay}>
          <div style={styles.offlineCard}>
            <div style={styles.offlinePulse}></div>
            <h2 style={styles.offlineTitle}>Plex Connection Lost</h2>
            <p style={styles.offlineSubtitle}>
              We lost our connection to your Plex Media Server. Please make sure your server is running and connected to the same network.
            </p>
            <button 
              onClick={() => plexBridge.ping()} 
              style={styles.retryButton}
            >
              Retry Connection
            </button>
          </div>
        </div>
      )}
    </WebOSInputProvider>
  )
}

const styles = {
  offlineOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    width: '100vw',
    height: '100vh',
    backgroundColor: 'rgba(10, 6, 8, 0.9)',
    backdropFilter: 'blur(20px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    animation: 'fadeIn 0.3s ease-out'
  },
  offlineCard: {
    width: '550px',
    padding: '40px',
    borderRadius: '24px',
    border: '1px solid rgba(229, 169, 59, 0.2)',
    background: 'linear-gradient(135deg, rgba(30, 20, 25, 0.8) 0%, rgba(15, 10, 12, 0.95) 100%)',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6)',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  offlinePulse: {
    width: '64px',
    height: '64px',
    borderRadius: '50%',
    backgroundColor: '#e5a93b',
    opacity: 0.15,
    animation: 'pulse 2s infinite ease-in-out',
    marginBottom: '24px'
  },
  offlineTitle: {
    fontSize: '32px',
    fontWeight: '800',
    color: '#e5a93b',
    margin: '0 0 16px 0',
    fontFamily: "'Outfit', sans-serif",
    letterSpacing: '-0.5px'
  },
  offlineSubtitle: {
    fontSize: '16px',
    color: 'rgba(255, 255, 255, 0.7)',
    lineHeight: '1.6',
    margin: '0 0 32px 0',
    maxWidth: '450px'
  },
  retryButton: {
    padding: '14px 32px',
    fontSize: '16px',
    fontWeight: '700',
    color: '#0d0406',
    backgroundColor: '#e5a93b',
    border: 'none',
    borderRadius: '12px',
    cursor: 'pointer',
    boxShadow: '0 8px 20px rgba(229, 169, 59, 0.3)',
    transition: 'transform 0.2s ease, background-color 0.2s ease',
    fontFamily: "'Inter', sans-serif"
  }
}

export default App