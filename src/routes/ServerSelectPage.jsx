import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { getServers, getBestServerConnection, testConnectionToServer } from '../services/plex/plexAPIServer'
import { getLibraries } from '../services/plex/plexContentService'
import { useAppStore } from '../stores/AppStore'
import { useServerManagerStore } from '../stores/serverManagerStore'
import { FiAlertCircle, FiMonitor, FiCheck } from 'react-icons/fi'
import { getSharedServerToken, discoverSharedServer, getSharedServersCache, saveSharedServersCache } from '../services/plex/sharedServerService'

function ServerSelectPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState([])
  const [error, setError] = useState('')

  const selectedLibraries = useAppStore(state => state.selectedLibraries) || []
  const hasSelections = selectedLibraries.length > 0

  useEffect(() => {
    loadServers()
  }, [])

  useEffect(() => {
    if (!loading && servers.length > 0) {
      setTimeout(() => {
        const el = document.getElementById(`server-${servers[0].clientIdentifier}`)
        if (el) el.focus({ preventScroll: true })
      }, 100)
    }
  }, [loading, servers])

  const loadServers = async () => {
    console.log('[AUTH FLOW] ServerSelectPage: Starting to load Plex Media Servers...')
    try {
      const token = useAppStore.getState().token
      console.log('[AUTH FLOW] ServerSelectPage: Main account token resolved successfully. Calling Plex API...')
      const serverList = await getServers(token, { ownedOnly: false })

      console.log(`[AUTH FLOW] ServerSelectPage: Discovered ${serverList.length} Plex Media Server(s):`, serverList.map(s => s.name))

      if (serverList.length === 0) {
        setError('No servers found. Please make sure your Plex Media Server is running.')
        setLoading(false)
        return
      }

      setServers(serverList)
      setLoading(false)

      // Background prefetching for shared servers to resolve connection/tokens early
      const sharedServers = serverList.filter(s => !s.owned)
      for (const shared of sharedServers) {
        getSharedServerToken(token, shared.clientIdentifier, null).catch(err => {
          console.warn(`[AUTH FLOW] Background prefetch failed for shared server "${shared.name}":`, err)
        })
      }
    } catch (err) {
      console.error('[AUTH FLOW] ServerSelectPage: Failed to load servers:', err)
      setError('Connection failed. Please check your network and try again.')
      setLoading(false)
    }
  }

  const selectServer = async (server) => {
    console.log(`[AUTH FLOW] ServerSelectPage: Selecting server: "${server.name}"`)
    try {
      setLoading(true)
      const token = useAppStore.getState().token

      if (server.owned) {
        console.log(`[AUTH FLOW] ServerSelectPage: Probing server connections for "${server.name}" to select the fastest path...`)
        const bestUri = await getBestServerConnection(server, server.accessToken)

        if (bestUri) {
          console.log(`[AUTH FLOW] ServerSelectPage: Connection resolved! Saving working connection URI: "${bestUri}"`)
          
          // Save to new multi-server architecture
          const smStore = useServerManagerStore.getState()
          const newServers = {
            ...smStore.servers,
            [server.clientIdentifier]: {
              name: server.name,
              clientIdentifier: server.clientIdentifier,
              accessToken: server.accessToken,
              uri: bestUri,
              owned: true,
              connections: server.connections || []
            }
          }
          useServerManagerStore.setState({ servers: newServers })
          smStore.saveServersToCache(newServers)

          useAppStore.setState({ hasServer: true })

          console.log('[AUTH FLOW] ServerSelectPage: Done! Navigating to library select (/library-select)...')
          navigate('/library-select', {
            state: {
              isShared: false,
              serverClientId: server.clientIdentifier,
              serverName: server.name,
              uri: bestUri,
              token: server.accessToken
            }
          })
          return
        }
      } else {
        // Shared Server onboarding - run getSharedServerToken check/flow
        console.log(`[AUTH FLOW] ServerSelectPage: Resolving shared server "${server.name}"...`)
        const sharedInfo = await getSharedServerToken(token, server.clientIdentifier, null)
        
        if (sharedInfo && sharedInfo.uri && sharedInfo.token) {
          // Register the shared server credentials in local cache immediately
          const cache = await getSharedServersCache()
          cache[server.clientIdentifier] = sharedInfo
          await saveSharedServersCache(cache)

          useAppStore.setState({ hasServer: true })

          console.log('[AUTH FLOW] ServerSelectPage: Shared server resolved! Navigating to library select...')
          navigate('/library-select', {
            state: {
              isShared: true,
              serverClientId: server.clientIdentifier,
              serverName: server.name,
              uri: sharedInfo.uri,
              token: sharedInfo.token
            }
          })
          return
        }
      }

      console.error(`[AUTH FLOW] ServerSelectPage: Failed to establish a connection to "${server.name}".`)
      setError(`Could not connect to "${server.name}". Please ensure secure connections are allowed or server is online.`)
      setLoading(false)
    } catch (err) {
      console.error('[AUTH FLOW] ServerSelectPage: Failed to select server:', err)
      setError('Failed to establish a stable connection with the server.')
      setLoading(false)
    }
  }

  const handleDone = () => {
    if (!hasSelections) return
    console.log('[AUTH FLOW] ServerSelectPage: Completing onboarding. Navigating to browse...')
    sessionStorage.setItem('activeSession', 'true')
    navigate('/browse', { replace: true })
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinnerContainer}>
          <div className="spinner"></div>
          <p style={styles.spinnerText}>Searching for Plex servers...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <div style={styles.errorIcon}>
            <FiAlertCircle size={64} color="#ea4335" strokeWidth={2} />
          </div>
          <p style={styles.errorText}>{error}</p>
          <FocusableItem
            id="error-retry-btn"
            rowIndex={0}
            colIndex={0}
            onClick={loadServers}
            className="retry-btn"
          >
            <div style={styles.retryButton}>Try Again</div>
          </FocusableItem>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <style>{`
        .spinner {
          border: 4px solid rgba(255, 255, 255, 0.1);
          width: 70px;
          height: 70px;
          border-radius: 50%;
          border-left-color: #ffffff;
          animation: spin 1s linear infinite;
          margin: 0 auto 30px;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        .server-item {
          transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
          border-radius: 24px;
        }
        .server-item[style] {
          transform: scale(1) !important;
        }
        .server-item.focused {
          transform: scale(1.08) !important;
        }
        .server-item.focused .server-card {
          background: rgba(255, 255, 255, 0.12) !important;
          border-color: rgba(255, 255, 255, 0.8) !important;
          box-shadow: 0 15px 40px rgba(255, 255, 255, 0.25) !important;
        }
        .server-item.focused .server-icon svg {
          stroke: #ffffff !important;
          transform: scale(1.08);
        }
        .retry-btn {
          margin-top: 30px;
          display: inline-block;
          border-radius: 50px;
          transition: all 0.2s ease;
        }
        .retry-btn.focused {
          transform: scale(1.08) !important;
          box-shadow: 0 0 25px rgba(234, 67, 53, 0.4) !important;
        }
        .retry-btn.focused div {
          background-color: #ea4335 !important;
          border-color: #ea4335 !important;
          color: #ffffff !important;
        }
        
        .action-btn {
          display: inline-block;
          border-radius: 50px;
          transition: all 0.2s ease;
          outline: none;
        }
        .action-btn.focused {
          transform: translateY(-6px) scale(1.05) !important;
        }
        .action-btn.focused .btn-inner {
          background-color: #ffffff !important;
          color: #1a1a1a !important;
          border-color: #ffffff !important;
          box-shadow: 0 10px 20px rgba(0, 0, 0, 0.4);
        }
        .action-btn.disabled {
          opacity: 0.35;
          pointer-events: none;
        }
      `}</style>

      <div style={styles.content}>
        <h1 style={styles.title}>Select a Server</h1>
        <p style={styles.subtitle}>Choose a Plex Media Server to access your library</p>

        <div style={styles.serverGrid}>
          {servers.map((server, index) => {
            const serverLibs = selectedLibraries.filter(l => l.serverClientId === server.clientIdentifier)
            const hasLibsSelected = serverLibs.length > 0
            
            return (
              <FocusableItem
                key={server.clientIdentifier}
                id={`server-${server.clientIdentifier}`}
                rowIndex={0}
                colIndex={index}
                onClick={() => selectServer(server)}
                className="server-item"
              >
                <div style={styles.serverCard}>
                  <div style={styles.serverIcon} className="server-icon">
                    <FiMonitor size={100} color="rgba(255, 255, 255, 0.6)" strokeWidth={1.5} style={{ display: 'block', margin: '0 auto', transition: 'stroke 0.25s ease, transform 0.25s ease' }} />
                  </div>
                  {hasLibsSelected && (
                    <div style={styles.selectionTickBadge}>
                      <FiCheck size={18} color="#2e7d32" strokeWidth={3} />
                    </div>
                  )}
                  {!server.owned && <div style={styles.sharedBadge}>Shared</div>}
                  <p style={styles.serverName}>{server.name}</p>
                </div>
              </FocusableItem>
            )
          })}
        </div>

        <div style={styles.actionRow}>
          <FocusableItem
            id="server-done-btn"
            rowIndex={1}
            colIndex={0}
            onClick={handleDone}
            className={`action-btn ${!hasSelections ? 'disabled' : ''}`}
          >
            <div style={{ ...styles.actionButton, backgroundColor: '#1a1a1a', borderColor: '#1a1a1a', color: '#ffffff' }} className="btn-inner">Done</div>
          </FocusableItem>
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '0 80px',
    overflow: 'hidden'
  },
  content: {
    textAlign: 'center',
    maxWidth: '1600px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%'
  },
  title: {
    fontSize: '76px',
    marginBottom: '15px',
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    letterSpacing: '-1px'
  },
  subtitle: {
    fontSize: '32px',
    color: '#9aa0a6',
    marginBottom: '80px',
    fontWeight: '400',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  serverGrid: {
    display: 'flex',
    gap: '50px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'center',
    width: '100%',
    marginBottom: '50px'
  },
  serverCard: {
    cursor: 'pointer',
    textAlign: 'center',
    padding: '50px 70px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '1.5px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '24px',
    transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s ease',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
    width: '380px',
    position: 'relative'
  },
  serverIcon: {
    marginBottom: '30px'
  },
  serverName: {
    fontSize: '38px',
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: '15px',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  sharedBadge: {
    display: 'inline-block',
    padding: '4px 12px',
    backgroundColor: 'rgba(234, 67, 53, 0.2)',
    color: '#ea4335',
    border: '1px solid rgba(234, 67, 53, 0.4)',
    borderRadius: '12px',
    fontSize: '14px',
    fontWeight: 'bold',
    textTransform: 'uppercase',
    marginBottom: '12px'
  },
  selectionTickBadge: {
    position: 'absolute',
    top: '20px',
    right: '20px',
    width: '32px',
    height: '32px',
    borderRadius: '50%',
    backgroundColor: 'rgba(46, 125, 50, 0.15)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  spinnerContainer: {
    textAlign: 'center'
  },
  spinnerText: {
    fontSize: '32px',
    color: '#bdc1c6',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  errorCard: {
    padding: '60px 80px',
    background: 'rgba(25, 25, 30, 0.95)',
    border: '1.5px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '24px',
    textAlign: 'center',
    maxWidth: '700px',
    boxShadow: '0 20px 45px rgba(0,0,0,0.5)'
  },
  errorIcon: {
    marginBottom: '25px'
  },
  errorText: {
    fontSize: '30px',
    color: '#f28b82',
    lineHeight: '1.5',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    marginBottom: '10px'
  },
  retryButton: {
    fontSize: '26px',
    padding: '16px 48px',
    backgroundColor: 'transparent',
    color: '#ffffff',
    border: '2px solid rgba(255, 255, 255, 0.2)',
    borderRadius: '50px',
    cursor: 'pointer',
    fontWeight: '600',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  actionRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '30px'
  },
  actionButton: {
    fontSize: '26px',
    padding: '16px 64px',
    backgroundColor: 'transparent',
    color: '#ffffff',
    border: '2px solid #ffffff',
    borderRadius: '50px',
    fontWeight: '700',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    transition: 'background-color 0.2s, color 0.2s'
  }
}

export default ServerSelectPage
