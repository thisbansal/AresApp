import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { getServers, getBestServerConnection } from '../services/plex/plexAPIServer'
import { useAppStore } from '../stores/AppStore'

function ServerSelectPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState([])
  const [error, setError] = useState('')

  const selectedLibraryIds = useAppStore(state => state.selectedLibraryIds)
  const selectedLibrariesByServer = useAppStore(state => state.selectedLibrariesByServer)

  const hasSelections = selectedLibraryIds.length > 0 || Object.values(selectedLibrariesByServer).some(libs => libs.length > 0)

  useEffect(() => {
    loadServers()
  }, [])

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

      console.log(`[AUTH FLOW] ServerSelectPage: Probing server connections for "${server.name}" to select the fastest path...`)
      const bestUri = await getBestServerConnection(server, server.accessToken)

      if (bestUri) {
        console.log(`[AUTH FLOW] ServerSelectPage: Connection resolved! Saving working connection URI: "${bestUri}"`)
        
        if (server.owned) {
          await useAppStore.getState().setServerUri(bestUri, server.accessToken)
        }

        console.log('[AUTH FLOW] ServerSelectPage: Done! Navigating to library select (/library-select)...')
        navigate('/library-select', {
          state: {
            isShared: !server.owned,
            serverClientId: server.clientIdentifier,
            serverName: server.name,
            uri: bestUri,
            token: server.accessToken
          }
        })
        return
      }

      console.error(`[AUTH FLOW] ServerSelectPage: Failed to establish a connection to "${server.name}" (none of the connections responded).`)
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
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#ea4335" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10"></circle>
              <line x1="12" y1="8" x2="12" y2="12"></line>
              <line x1="12" y1="16" x2="12.01" y2="16"></line>
            </svg>
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
          border: 4px solid rgba(0, 0, 0, 0.1);
          width: 70px;
          height: 70px;
          border-radius: 50%;
          border-left-color: #000000;
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
          background: #ffffff !important;
          border-color: #000000 !important;
          box-shadow: 0 15px 40px rgba(0, 0, 0, 0.12) !important;
        }
        .server-item.focused .server-icon svg {
          stroke: #000000 !important;
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
          transform: scale(1.08) !important;
          box-shadow: 0 0 25px rgba(0, 0, 0, 0.2) !important;
        }
        .action-btn.focused .btn-inner {
          background-color: #ffffff !important;
          color: #000000 !important;
          border-color: #000000 !important;
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
            const serverLibs = server.owned ? selectedLibraryIds : (selectedLibrariesByServer[server.clientIdentifier] || [])
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
                    <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="rgba(0, 0, 0, 0.5)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto', transition: 'stroke 0.25s ease, transform 0.25s ease' }}>
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                      <line x1="8" y1="21" x2="16" y2="21"></line>
                      <line x1="12" y1="17" x2="12" y2="21"></line>
                    </svg>
                  </div>
                  {hasLibsSelected && (
                    <div style={styles.selectionTickBadge}>
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2e7d32" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                      </svg>
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
            <div style={{ ...styles.actionButton, backgroundColor: '#000000', borderColor: '#000000', color: '#ffffff' }} className="btn-inner">Done</div>
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
    overflow: 'hidden',
    backgroundColor: '#ffffff'
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
    color: '#1a1a1a',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    letterSpacing: '-1px'
  },
  subtitle: {
    fontSize: '32px',
    color: '#5f6368',
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
    background: '#ffffff',
    border: '1.5px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '24px',
    transition: 'transform 0.15s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.15s ease',
    boxShadow: '0 8px 30px rgba(0, 0, 0, 0.04)',
    width: '380px',
    position: 'relative'
  },
  serverIcon: {
    marginBottom: '30px'
  },
  serverName: {
    fontSize: '38px',
    color: '#1a1a1a',
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
    backgroundColor: 'rgba(234, 67, 53, 0.08)',
    color: '#ea4335',
    border: '1px solid rgba(234, 67, 53, 0.2)',
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
    backgroundColor: 'rgba(46, 125, 50, 0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  spinnerContainer: {
    textAlign: 'center'
  },
  spinnerText: {
    fontSize: '32px',
    color: '#5f6368',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  errorCard: {
    padding: '60px 80px',
    background: '#ffffff',
    border: '1.5px solid rgba(0, 0, 0, 0.08)',
    borderRadius: '24px',
    textAlign: 'center',
    maxWidth: '700px',
    boxShadow: '0 8px 30px rgba(0,0,0,0.06)'
  },
  errorIcon: {
    marginBottom: '25px'
  },
  errorText: {
    fontSize: '30px',
    color: '#d93838',
    lineHeight: '1.5',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    marginBottom: '10px'
  },
  retryButton: {
    fontSize: '26px',
    padding: '16px 48px',
    backgroundColor: 'transparent',
    color: '#1a1a1a',
    border: '2px solid rgba(0, 0, 0, 0.15)',
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
    border: '2px solid #000000',
    borderRadius: '50px',
    fontWeight: '700',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    transition: 'background-color 0.2s, color 0.2s'
  }
}

export default ServerSelectPage

