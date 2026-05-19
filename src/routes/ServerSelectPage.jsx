import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { getServers, getBestServerConnection } from '../services/plex/plexAPIServer'
import { getMainToken } from '../services/luna/tokenStorage'
import { DB_KINDS, setData } from '../services/luna/lunaService'
import { KINDS } from '../config/app'

function ServerSelectPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    loadServers()
  }, [])

  const loadServers = async () => {
    console.log('[AUTH FLOW] ServerSelectPage: Starting to load Plex Media Servers...')
    try {
      const token = await getMainToken()
      console.log('[AUTH FLOW] ServerSelectPage: Main account token resolved successfully. Calling Plex API...')
      const serverList = await getServers(token)

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
        await setData(DB_KINDS.SERVER, KINDS.server, bestUri)
        console.log('Saved PMS server:', KINDS.server, bestUri)

        // Also save the full server object for later use (optional)
        const selectedServer = {
          ...server,
          activeConnection: bestUri
        }

        console.log('[AUTH FLOW] ServerSelectPage: Done! Navigating to profile select (/user-select)...')
        navigate('/user-select')
        return
      }

      // If we get here, no connections worked
      console.error(`[AUTH FLOW] ServerSelectPage: Failed to establish a connection to "${server.name}" (none of the connections responded).`)
      setError(`Could not connect to "${server.name}". Please ensure secure connections are allowed or server is online.`)
      setLoading(false)
    } catch (err) {
      console.error('[AUTH FLOW] ServerSelectPage: Failed to select server:', err)
      setError('Failed to establish a stable connection with the server.')
      setLoading(false)
    }
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
        }
      `}</style>

      <div style={styles.content}>
        <h1 style={styles.title}>Select a Server</h1>
        <p style={styles.subtitle}>Choose a Plex Media Server to access your library</p>

        <div style={styles.serverGrid}>
          {servers.map((server, index) => (
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
                  <svg width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="rgba(255, 255, 255, 0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto', transition: 'stroke 0.25s ease, transform 0.25s ease' }}>
                    <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
                    <line x1="8" y1="21" x2="16" y2="21"></line>
                    <line x1="12" y1="17" x2="12" y2="21"></line>
                  </svg>
                </div>
                <p style={styles.serverName}>{server.name}</p>
                <div style={styles.connectionBadge}>
                  <span style={styles.badgeDot}></span>
                  <span style={styles.serverConnections}>
                    {server.connections.length} path{server.connections.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            </FocusableItem>
          ))}
        </div>
      </div>
    </div>
  )
}

const PLEX_YELLOW = '#ffffff'

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    padding: '0 80px',
    background: 'radial-gradient(circle at center, #1d2024 0%, #0d0f11 100%)',
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
    width: '100%'
  },
  serverCard: {
    cursor: 'pointer',
    textAlign: 'center',
    padding: '50px 70px',
    background: 'rgba(255, 255, 255, 0.04)',
    backdropFilter: 'blur(25px) saturate(180%)',
    WebkitBackdropFilter: 'blur(25px) saturate(180%)',
    border: '1.5px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '24px',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.45)',
    width: '380px'
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
  connectionBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 24px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '50px',
    border: '1px solid rgba(255, 255, 255, 0.08)'
  },
  badgeDot: {
    width: '14px',
    height: '14px',
    backgroundColor: '#34a853',
    borderRadius: '50%'
  },
  serverConnections: {
    fontSize: '28px',
    color: '#bdc1c6',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    fontWeight: '600'
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
    background: 'rgba(255, 255, 255, 0.03)',
    backdropFilter: 'blur(20px)',
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
  }
}

export default ServerSelectPage