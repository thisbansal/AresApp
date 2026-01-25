import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { getToken } from '../services/configurator/lunaTokenService'
import { getServers, testConnectionToServer } from '../services/plex/plexAPIServer'

function ServerSelectPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [servers, setServers] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    loadServers()
  }, [])

  const loadServers = async () => {
    try {
      const token = await getToken()

      const serverList = await getServers(token)

      if (serverList.length === 0) {
        setError('No servers found')
        setLoading(false)
        return
      }

      setServers(serverList)
      setLoading(false)
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const selectServer = async (server) => {
    for (const conn of server.connections) {
      const works = await testConnectionToServer(conn.uri, server.accessToken)
      if (works) {
        const selectedServer = {
          ...server,
          activeConnection: conn.uri
        }

        localStorage.setItem('pmsServer', JSON.stringify(selectedServer))
        navigate('/user-select')
        return
      }
    }

    setError('Could not connect to server')
    setLoading(false)
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner}>Loading servers...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <p style={styles.errorText}>{error}</p>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Select a Server</h1>

        <div style={styles.serverGrid}>
          {servers.map((server, index) => (
            <FocusableItem
              key={server.clientIdentifier}
              id={`server-${server.clientIdentifier}`}
              rowIndex={0}
              colIndex={index}
              onClick={() => selectServer(server)}
            >
              <div style={styles.serverCard}>
                <div style={styles.serverIcon}>🖥️</div>
                <p style={styles.serverName}>{server.name}</p>
                <p style={styles.serverConnections}>
                  {server.connections.length} connection{server.connections.length !== 1 ? 's' : ''}
                </p>
              </div>
            </FocusableItem>
          ))}
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
    padding: '80px'
  },
  content: {
    textAlign: 'center',
    maxWidth: '1600px',
    width: '100%'
  },
  title: {
    fontSize: '96px',
    marginBottom: '120px',
    fontWeight: 'bold',
    color: '#e8eaed'
  },
  serverGrid: {
    display: 'flex',
    gap: '80px',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  serverCard: {
    cursor: 'pointer',
    textAlign: 'center',
    padding: '60px 80px',
    background: '#3c3f43',
    borderRadius: '16px',
    border: '4px solid #e5a00d',
    transition: 'transform 0.3s ease'
  },
  serverIcon: {
    fontSize: '120px',
    marginBottom: '30px'
  },
  serverName: {
    fontSize: '48px',
    color: '#e8eaed',
    fontWeight: '600',
    marginBottom: '20px'
  },
  serverConnections: {
    fontSize: '32px',
    color: '#9aa0a6'
  },
  spinner: {
    fontSize: '48px',
    color: '#e8eaed'
  },
  error: {
    textAlign: 'center'
  },
  errorText: {
    fontSize: '36px',
    color: '#ea4335'
  }
}

export default ServerSelectPage