import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { getLibraries } from '../services/plex/plexContentService'
import { useAppStore } from '../stores/AppStore'
import { getSharedServerToken, getSharedServersCache, saveSharedServersCache } from '../services/plex/sharedServerService'
import { getMainToken } from '../services/luna/tokenStorage'
import { useServerStore } from '../stores/serverStore'

function LibrarySelectPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const isShared = location.state?.isShared || false
  const serverClientId = location.state?.serverClientId
  const fromSettings = location.state?.from === 'settings'

  const [loading, setLoading] = useState(true)
  const [libraries, setLibraries] = useState([])
  const [selectedIds, setSelectedIds] = useState([])
  const [error, setError] = useState('')

  useEffect(() => {
    loadLibraries()
  }, [])

  const loadLibraries = async () => {
    console.log('[AUTH FLOW] LibrarySelectPage: Fetching available libraries...')
    try {
      let targetUri = ''
      let targetToken = ''
      let initialSelected = []

      // If connection parameters were already resolved and passed in location state
      if (location.state?.uri && location.state?.token) {
        targetUri = location.state.uri
        targetToken = location.state.token
        if (isShared && serverClientId) {
          initialSelected = useAppStore.getState().selectedLibrariesByServer[serverClientId] || []
        } else {
          initialSelected = useAppStore.getState().selectedLibraryIds || []
        }
      } else if (isShared && serverClientId) {
        // Dynamic lookup fallback (e.g. from Settings panel)
        const mainToken = useAppStore.getState().mainToken || await getMainToken()
        const activeOwnServer = useServerStore.getState().activeServer
        const sharedInfo = await getSharedServerToken(mainToken, serverClientId, activeOwnServer)
        targetUri = sharedInfo.uri
        targetToken = sharedInfo.token
        initialSelected = useAppStore.getState().selectedLibrariesByServer[serverClientId] || []
      } else {
        const { serverUri, token, setupServerToken, selectedLibraryIds } = useAppStore.getState()
        targetUri = serverUri
        targetToken = setupServerToken || token
        initialSelected = selectedLibraryIds || []
      }

      if (!targetUri || !targetToken) {
        throw new Error('Missing server connection details.')
      }

      const libs = await getLibraries(targetUri, targetToken)
      console.log(`[AUTH FLOW] LibrarySelectPage: Found ${libs.length} libraries.`)

      if (libs.length === 0) {
        setError('No libraries found on this server.')
        setLoading(false)
        return
      }

      setLibraries(libs)
      setSelectedIds(initialSelected)
      setLoading(false)
    } catch (err) {
      console.error('[AUTH FLOW] LibrarySelectPage: Error loading libraries:', err)
      setError('Failed to load libraries. Please check your connection.')
      setLoading(false)
    }
  }

  const toggleLibrary = async (id) => {
    const updatedIds = selectedIds.includes(id)
      ? selectedIds.filter(lId => lId !== id)
      : [...selectedIds, id]

    setSelectedIds(updatedIds)

    try {
      if (isShared && serverClientId) {
        await useAppStore.getState().setSelectedLibrariesForServer(serverClientId, updatedIds)
        
        // Ensure shared server auth is registered persistently in cache
        const cache = await getSharedServersCache()
        const resolvedUri = location.state?.uri || cache[serverClientId]?.uri
        const resolvedToken = location.state?.token || cache[serverClientId]?.token
        
        if (resolvedUri && resolvedToken) {
          cache[serverClientId] = {
            token: resolvedToken,
            uri: resolvedUri,
            timestamp: Date.now()
          }
          await saveSharedServersCache(cache)
        }
      } else {
        await useAppStore.getState().setSelectedLibraries(updatedIds)
      }
      console.log('[AUTH FLOW] LibrarySelectPage: Selection saved immediately:', updatedIds)
    } catch (err) {
      console.error('[AUTH FLOW] LibrarySelectPage: Failed to save immediately:', err)
    }
  }

  const handleBack = () => {
    if (fromSettings) {
      navigate('/browse', { replace: true })
    } else {
      if (!isShared && selectedIds.length === 0) {
        console.log('[AUTH FLOW] LibrarySelectPage: Back blocked. Needs at least 1 library.')
        return
      }
      navigate('/server-select')
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinnerContainer}>
          <div className="spinner"></div>
          <p style={styles.spinnerText}>Discovering libraries...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.errorCard}>
          <p style={styles.errorText}>{error}</p>
          <FocusableItem
            id="error-retry-btn"
            rowIndex={0}
            colIndex={0}
            onClick={loadLibraries}
            className="retry-btn"
          >
            <div style={styles.actionButton}>Try Again</div>
          </FocusableItem>
          <FocusableItem
            id="error-back-btn"
            rowIndex={0}
            colIndex={1}
            onClick={handleBack}
            className="retry-btn"
          >
            <div style={styles.actionButton}>Go Back</div>
          </FocusableItem>
        </div>
      </div>
    )
  }

  const isBackDisabled = !fromSettings && !isShared && selectedIds.length === 0

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
        .lib-item {
          transition: transform 0.2s ease, box-shadow 0.2s ease !important;
          border-radius: 20px;
          outline: none;
        }
        .lib-item.focused {
          transform: scale(1.05) !important;
          box-shadow: 0 0 20px rgba(255, 255, 255, 0.3) !important;
        }
        .lib-item.focused .lib-card {
          border-color: #ffffff !important;
        }
        
        .action-btn {
          display: inline-block;
          border-radius: 50px;
          transition: all 0.2s ease;
          outline: none;
        }
        .action-btn.focused {
          transform: scale(1.08) !important;
          box-shadow: 0 0 25px rgba(255, 255, 255, 0.4) !important;
        }
        .action-btn.focused .btn-inner {
          background-color: #000000 !important;
          color: #ffffff !important;
          border-color: #ffffff !important;
        }
        .action-btn.disabled {
          opacity: 0.35;
          pointer-events: none;
        }
      `}</style>

      <div style={styles.content}>
        <h1 style={styles.title}>Select Your Libraries</h1>
        <p style={styles.subtitle}>Choose the libraries you want to pin to your navigation bar</p>

        <div style={styles.grid}>
          {libraries.map((lib, index) => {
            const isSelected = selectedIds.includes(lib.id)
            return (
              <FocusableItem
                key={lib.id}
                id={`lib-${lib.id}`}
                rowIndex={0}
                colIndex={index}
                onClick={() => toggleLibrary(lib.id)}
                className="lib-item"
              >
                <div style={{
                  ...styles.libraryCard,
                  ...(isSelected ? styles.libraryCardSelected : {})
                }} className="lib-card">
                  <div style={styles.checkboxContainer}>
                    <div style={{
                      ...styles.checkbox,
                      ...(isSelected ? styles.checkboxChecked : {})
                    }}>
                      {isSelected && (
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                      )}
                    </div>
                  </div>
                  <h3 style={styles.libraryTitle}>{lib.title}</h3>
                  <p style={styles.libraryType}>{lib.type}</p>
                </div>
              </FocusableItem>
            )
          })}
        </div>

        <div style={styles.actionRow}>
          <FocusableItem
            id="lib-back-btn"
            rowIndex={1}
            colIndex={0}
            onClick={handleBack}
            className={`action-btn ${isBackDisabled ? 'disabled' : ''}`}
          >
            <div style={{ ...styles.actionButton, backgroundColor: '#ffffff', borderColor: '#ffffff', color: '#000000' }} className="btn-inner">Back</div>
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
    position: 'relative'
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
    fontSize: '64px',
    marginBottom: '15px',
    fontWeight: '800',
    color: '#ffffff',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    letterSpacing: '-1px'
  },
  subtitle: {
    fontSize: '28px',
    color: '#9aa0a6',
    marginBottom: '60px',
    fontWeight: '400',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  grid: {
    display: 'flex',
    gap: '30px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'center',
    width: '100%',
    maxWidth: '1400px',
    marginBottom: '60px',
    maxHeight: '50vh',
    overflowY: 'auto',
    padding: '20px'
  },
  libraryCard: {
    cursor: 'pointer',
    textAlign: 'center',
    padding: '30px 40px',
    background: 'rgba(255, 255, 255, 0.08)',
    border: '2px solid rgba(255, 255, 255, 0.12)',
    borderRadius: '20px',
    width: '280px',
    position: 'relative',
    transition: 'background-color 0.2s ease, border-color 0.2s ease'
  },
  libraryCardSelected: {
    background: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.5)'
  },
  checkboxContainer: {
    position: 'absolute',
    top: '20px',
    right: '20px',
  },
  checkbox: {
    width: '32px',
    height: '32px',
    borderRadius: '8px',
    border: '2px solid rgba(255, 255, 255, 0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  checkboxChecked: {
    backgroundColor: '#ffffff',
    borderColor: '#ffffff'
  },
  libraryTitle: {
    fontSize: '32px',
    color: '#ffffff',
    fontWeight: '600',
    marginBottom: '10px',
    marginTop: '20px',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  libraryType: {
    fontSize: '20px',
    color: '#9aa0a6',
    textTransform: 'capitalize',
    fontFamily: "'Outfit', 'Inter', sans-serif",
  },
  actionRow: {
    display: 'flex',
    gap: '40px',
    justifyContent: 'center',
    marginTop: '20px'
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
    textAlign: 'center'
  },
  errorText: {
    fontSize: '30px',
    color: '#f28b82',
    marginBottom: '30px',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  }
}

export default LibrarySelectPage
