import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { ServerOfflineMessage } from '../components/ServerOfflineMessage'
import { getLibraries } from '../services/plex/plexContentService'
import { useAppStore } from '../stores/AppStore'
import { getSharedServerToken, getSharedServersCache, saveSharedServersCache } from '../services/plex/sharedServerService'
import { getMainToken } from '../services/luna/tokenStorage'
import { useServerStore } from '../stores/serverStore'
import { useServerManagerStore } from '../stores/serverManagerStore'
import { FiCheck } from 'react-icons/fi'

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
    console.log('[AUTH FLOW] LibrarySelectPage: Fetching available libraries from ALL servers...')
    try {
      const smStore = useServerManagerStore.getState()
      const servers = Object.values(smStore.servers)
      
      if (servers.length === 0) {
        setError('No reachable servers found.')
        setLoading(false)
        return
      }

      const allLibs = []
      const initialSelected = []
      const currentSelections = useAppStore.getState().selectedLibraries || []

      // Extract existing selections to prepopulate checkboxes
      currentSelections.forEach(sel => {
        initialSelected.push(`${sel.serverClientId}|${sel.id}`)
      })

      const { getLibrariesCached } = await import('../services/caching/MediaCacheService')

      const promises = servers.map(async (server) => {
        try {
          const libs = await getLibrariesCached(server.uri, server.accessToken)
          const videoLibs = libs.filter(l => l.type === 'movie' || l.type === 'show')
          
          videoLibs.forEach(l => {
            allLibs.push({
              ...l,
              serverClientId: server.clientIdentifier,
              serverName: server.name,
              isOwned: server.owned
            })
          })
        } catch (err) {
          console.warn(`[LibrarySelectPage] Failed to load libraries for server ${server.name}`, err)
        }
      })

      await Promise.allSettled(promises)

      console.log(`[AUTH FLOW] LibrarySelectPage: Found ${allLibs.length} total libraries across servers.`)

      if (allLibs.length === 0) {
        setError('No libraries found on any server.')
        setLoading(false)
        return
      }

      setLibraries(allLibs)
      setSelectedIds(initialSelected)
      setLoading(false)
    } catch (err) {
      console.error('[AUTH FLOW] LibrarySelectPage: Error loading libraries:', err)
      setError('Failed to load libraries. Please check your connection.')
      setLoading(false)
    }
  }

  const toggleLibrary = async (compositeId) => {
    const updatedIds = selectedIds.includes(compositeId)
      ? selectedIds.filter(id => id !== compositeId)
      : [...selectedIds, compositeId]

    setSelectedIds(updatedIds)

    try {
      // Build the unified array of selected library objects to save
      const newSelectedLibraries = []
      
      updatedIds.forEach(idStr => {
        const [clientId, libId] = idStr.split('|')
        const libObj = libraries.find(l => l.serverClientId === clientId && l.id === libId)
        if (libObj) {
          newSelectedLibraries.push({
            id: libObj.id,
            serverClientId: libObj.serverClientId,
            title: libObj.title,
            type: libObj.type,
            isOwned: libObj.isOwned
          })
        }
      })

      await useAppStore.getState().setSelectedLibraries(newSelectedLibraries)
      console.log('[AUTH FLOW] LibrarySelectPage: Unified selection saved immediately:', newSelectedLibraries)
    } catch (err) {
      console.error('[AUTH FLOW] LibrarySelectPage: Failed to save immediately:', err)
    }
  }

  const handleBack = () => {
    if (!error && selectedIds.length === 0) {
      console.log('[AUTH FLOW] LibrarySelectPage: Back blocked. Needs at least 1 library.')
      return
    }
    if (fromSettings) {
      navigate('/browse', { replace: true })
    } else {
      navigate('/browse', { replace: true })
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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '30px' }}>
          <ServerOfflineMessage />
          
          <FocusableItem
            id="error-back-btn"
            rowIndex={0}
            colIndex={0}
            onClick={handleBack}
          >
            <div className="capsule-btn" style={{ padding: '16px 40px', fontSize: '22px' }}>
              Go Back
            </div>
          </FocusableItem>
        </div>
      </div>
    )
  }

  const isBackDisabled = selectedIds.length === 0

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
        <h1 style={styles.title}>Select Your Libraries</h1>
        <p style={styles.subtitle}>Choose the libraries you want to pin to your navigation bar</p>

        <div style={styles.grid}>
          {libraries.map((lib, index) => {
            const compositeId = `${lib.serverClientId}|${lib.id}`
            const isSelected = selectedIds.includes(compositeId)
            return (
              <FocusableItem
                key={compositeId}
                id={`lib-${compositeId}`}
                rowIndex={0}
                colIndex={index}
                onClick={() => toggleLibrary(compositeId)}
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
                        <FiCheck size={24} color="#000" strokeWidth={3} />
                      )}
                    </div>
                  </div>
                  <h3 style={styles.libraryTitle}>{lib.title}</h3>
                  <p style={styles.libraryType}>{lib.type}</p>
                  <p style={{...styles.libraryType, fontSize: '14px', marginTop: '4px'}}>{lib.serverName}</p>
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
            <div style={{ ...styles.actionButton, backgroundColor: '#1a1a1a', borderColor: '#1a1a1a', color: '#ffffff' }} className="btn-inner">Back</div>
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
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.12)',
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
    borderWidth: '2px',
    borderStyle: 'solid',
    borderColor: 'rgba(255, 255, 255, 0.4)',
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
