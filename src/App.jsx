import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { WebOSInputProvider } from './services/navigation/WebOSInputProvider'
import { EdgeScrollTriggers } from './components/navigational/EdgeScrollTriggers'
import { KeyboardHandler } from './components/navigational/KeyboardHandler'
import { ExitDialog } from './components/navigational/ExitDialog'
import { useServerStore } from './stores/serverStore'
import { useServerManagerStore } from './stores/serverManagerStore'
import { useAppStore } from './stores/AppStore'
import { plexBridge } from './services/plex/plexBridge'
import { useWebSocketStore } from './stores/webSocketStore'
import { SpatialNavigationProvider } from './contexts/SpatialNavigationContext'

import AuthRoute from './pages/Auth'
import LoginPage from './routes/LoginPage'
import UserSelectPage from './routes/UserSelectPage'
import ContentBrowserPage from './routes/ContentBrowserPage'
import ServerSelectPage from './routes/ServerSelectPage'
import LibrarySelectPage from './routes/LibrarySelectPage'
import MediaDetailsPage from './routes/MediaDetailsPage'
import PlayerPage from './routes/PlayerPage'

if ('scrollRestoration' in window.history) {
  window.history.scrollRestoration = 'manual'
}

function App() {
  const { isAuthenticated, hasServer, hasSession, isLoading, initializeAuth } = useAppStore()
  const isOnline = useServerStore(state => state.isOnline)
  const activeServer = useServerStore(state => state.activeServer)

  useEffect(() => {
    initializeAuth()
  }, [])

  // Listen for online transition to recover connection instantly
  useEffect(() => {
    const handleOnline = () => {
      console.log('[NETWORK] Network interface returned online. Triggering server check...');
      if (isAuthenticated && hasSession) {
        plexBridge.ping()
        useWebSocketStore.getState().reconnectAll()
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [isAuthenticated, hasSession])

  // Handle WebOS standby/resume to fix zombie sockets
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log('[LIFECYCLE] App resumed from standby. Reconnecting WebSockets...');
        useWebSocketStore.getState().reconnectAll()
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

  const serverCount = useServerManagerStore(state => Object.keys(state.servers).length);

  // Maintain WebSocket connection to all available Servers
  useEffect(() => {
    const smStore = useServerManagerStore.getState().servers;
    Object.values(smStore).forEach(server => {
      if (server.clientIdentifier && server.uri && server.accessToken) {
        useWebSocketStore.getState().connectToServer(
          server.clientIdentifier, 
          server.uri, 
          server.accessToken
        );
      }
    });
  }, [serverCount]);

  // Trigger initial ping once authenticated
  useEffect(() => {
    if (!isAuthenticated || !hasSession || !activeServer?.uri || !activeServer?.token) return
    plexBridge.ping()
  }, [isAuthenticated, hasSession, activeServer?.uri, activeServer?.token])

  // Show loading state while checking auth
  if (isLoading) {
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

      <SpatialNavigationProvider>
        <KeyboardHandler />
        <ExitDialog />
        <EdgeScrollTriggers />

      <div className="app">
        <Routes>
          <Route
            path="/login"
            element={
              <AuthRoute requireAuth={false}>
                <LoginPage />
              </AuthRoute>
            }
          />

          <Route
            path="/server-select"
            element={
              <AuthRoute requireAuth={true} allowIncompleteSession={true}>
                <ServerSelectPage />
              </AuthRoute>
            }
          />

          <Route
            path="/library-select"
            element={
              <AuthRoute requireAuth={true} allowIncompleteSession={true}>
                <LibrarySelectPage />
              </AuthRoute>
            }
          />

          <Route
            path="/user-select"
            element={
              <AuthRoute requireAuth={true} allowIncompleteSession={true}>
                <UserSelectPage />
              </AuthRoute>
            }
          />

          <Route
            path="/browse"
            element={
              <AuthRoute requireAuth={true}>
                <ContentBrowserPage />
              </AuthRoute>
            }
          />

          <Route
            path="/details/:ratingKey"
            element={
              <AuthRoute requireAuth={true}>
                <MediaDetailsPage />
              </AuthRoute>
            }
          />

          <Route
            path="/play/:ratingKey"
            element={
              <AuthRoute requireAuth={true}>
                <PlayerPage />
              </AuthRoute>
            }
          />

          <Route
            path="/"
            element={
              <Navigate
                to={isAuthenticated && hasSession ? "/browse" : "/login"}
                replace
              />
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>

      {/* Offline state is now handled gracefully inside the views without blocking navigation */}
      </SpatialNavigationProvider>
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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99999,
    // animation: 'fadeIn 0.3s ease-out'
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
    // animation: 'pulse 2s infinite ease-in-out',
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
