import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { getUsers, verifyUserPin } from '../services/plex/plexAuthService'
import { resolveAccessibleServer } from '../services/plex/plexAccessService'
import { useAppStore } from '../stores/AppStore'
import { getMainToken } from '../services/luna/tokenStorage'

function UserSelectPage() {
  const navigate = useNavigate()
  const [users, setUsers] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_users_list')
      return cached ? JSON.parse(cached) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(() => {
    try {
      const cached = localStorage.getItem('cached_users_list')
      return !cached
    } catch {
      return true
    }
  })
  const [selectedUser, setSelectedUser] = useState(null)
  const [showPinPrompt, setShowPinPrompt] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')
  const [loadingMessage, setLoadingMessage] = useState('Loading profiles...')

  useEffect(() => {
    checkExistingSession()
  }, [])

  // Auto-focus first button when PIN prompt opens
  useEffect(() => {
    if (showPinPrompt) {
      setTimeout(() => {
        const firstBtn = document.getElementById('numpad-1');
        if (firstBtn) {
          firstBtn.focus({ preventScroll: true });
        }
      }, 150);
    }
  }, [showPinPrompt])

  // Direct remote control number entry for PIN code
  useEffect(() => {
    if (!showPinPrompt) return

    const handlePinKeyDown = (e) => {
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        e.stopPropagation()
        const digit = e.key
        if (pin.length < 4) {
          const newPin = pin + digit
          setPin(newPin)
          if (newPin.length === 4) {
            setTimeout(() => handlePinSubmit(newPin), 200)
          }
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault()
        e.stopPropagation()
        setPin(prev => prev.slice(0, -1))
      }
    }

    window.addEventListener('keydown', handlePinKeyDown, true)
    return () => window.removeEventListener('keydown', handlePinKeyDown, true)
  }, [showPinPrompt, pin, selectedUser])

  const checkExistingSession = async () => {
    console.log('[AUTH FLOW] UserSelectPage: Checking for an existing, cached profile session...')
    try {
      const { hasSession: sessionComplete, userProfile: lastProfile } = useAppStore.getState()
      console.log('[AUTH FLOW] UserSelectPage: Loaded cached profile:', lastProfile, 'sessionComplete:', sessionComplete)

      // If we have a valid session and user chose to auto-login (rememberPin is enabled), navigate to browse
      if (sessionComplete && lastProfile && lastProfile.userId) {
        sessionStorage.setItem('activeSession', 'true')
        console.log('[AUTH FLOW] UserSelectPage: Valid session exists and auto-login is enabled! Directing user to browse page...')
        navigate('/browse')
        return
      }

      console.log('[AUTH FLOW] UserSelectPage: No cached session found. Proceeding to fetch available home users...')
      loadUsers()
    } catch (err) {
      console.error('[AUTH FLOW] UserSelectPage: Session check error:', err)
      loadUsers()
    }
  }

  const loadUsers = async () => {
    console.log('[AUTH FLOW] UserSelectPage: Loading home profiles...')
    try {
      const mainToken = useAppStore.getState().mainToken || await getMainToken()
      console.log('[AUTH FLOW] UserSelectPage: Main account token resolved successfully. Calling Plex API...')
      const userList = await getUsers(mainToken)
      console.log(`[AUTH FLOW] UserSelectPage: Discovered ${userList.length} user profile(s):`, userList.map(u => u.name))
      setUsers(userList)
      localStorage.setItem('cached_users_list', JSON.stringify(userList))
      setLoadingMessage('Loading profiles...')
      setLoading(false)
    } catch (err) {
      console.error('[AUTH FLOW] UserSelectPage: Failed to load profiles:', err)
      setLoadingMessage('Loading profiles...')
      setLoading(false)
    }
  }

  const completeProfileSignIn = async (user, pinValue, isProtected) => {
    setLoadingMessage(`Opening ${user.name}'s server... `)
    setLoading(true)

    try {
      const mainToken = useAppStore.getState().mainToken || await getMainToken()
      const userToken = await verifyUserPin(mainToken, user.id, pinValue || "")

      if (!userToken) {
        throw new Error('Profile token was not returned by Plex.')
      }

      const preferredUri = useAppStore.getState().serverUri
      const resolvedServer = await resolveAccessibleServer(userToken, preferredUri)
      const serverConnection = resolvedServer ? { uri: resolvedServer.uri, token: resolvedServer.token } : null

      sessionStorage.setItem('activeSession', 'true')
      if (resolvedServer?.uri && resolvedServer.uri !== preferredUri) {
        await useAppStore.getState().setServerUri(resolvedServer.uri)
      }

      await useAppStore.getState().setProfileSession(
        user.id,
        user.name,
        userToken,
        pinValue,
        false,
        isProtected,
        serverConnection
      )

      console.log('[AUTH FLOW] UserSelectPage: Done! Navigating to browse...')
      navigate('/browse')
    } catch (err) {
      console.error('[AUTH FLOW] UserSelectPage: Profile sign-in failed:', err)
      setLoadingMessage('Loading profiles...')
      setLoading(false)
      throw err
    }
  }

  const handleUserClick = (user) => {
    console.log(`[AUTH FLOW] UserSelectPage: Selected profile: "${user.name}" | requiresPIN: ${user.protected}`)
    setSelectedUser(user)

    if (user.protected) {
      setShowPinPrompt(true)
      setPin('')
      setPinError('')
    } else {
      console.log(`[AUTH FLOW] UserSelectPage: Profile "${user.name}" is unprotected. Proceeding to save session...`)
      saveUserSelection(user, null)
    }
  }

  const handlePinSubmit = async (enteredPin) => {
    console.log(`[AUTH FLOW] UserSelectPage: PIN entry complete. Verifying PIN for profile: "${selectedUser.name}"...`)
    if (enteredPin.length !== 4) {
      setPinError('Please enter a 4-digit PIN')
      setPin('')
      return
    }

    try {
      console.log('[AUTH FLOW] UserSelectPage: Main token resolved. Requesting verification from Plex API...')
      await completeProfileSignIn(selectedUser, enteredPin, true)
    } catch (err) {
      console.error('[AUTH FLOW] UserSelectPage: PIN verification failed:', err)
      setShowPinPrompt(true)
      setPinError('Incorrect PIN. Try again.')
      setPin('')
    }
  }

  const handlePinCancel = () => {
    console.log('[AUTH FLOW] UserSelectPage: PIN verification cancelled by user.')
    setShowPinPrompt(false)
    setSelectedUser(null)
    setPin('')
    setPinError('')
  }

  const saveUserSelection = async (user, pin) => {
    console.log(`[AUTH FLOW] UserSelectPage: Authenticating unprotected profile "${user.name}"...`)
    try {
      await completeProfileSignIn(user, null, false)
    } catch (err) {
      console.error('[AUTH FLOW] UserSelectPage: Unprotected user authentication failed:', err)
    }
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinnerContainer}>
          <div className="spinner"></div>
          <p style={styles.spinnerText}>{loadingMessage}</p>
        </div>
      </div>
    )
  }

  if (showPinPrompt) {
    return (
      <div style={styles.container}>
        <style>{`
          .numpad-btn {
            border-radius: 50% !important;
            will-change: transform;
            transform: translate3d(0, 0, 0) !important;
            transition: transform 0.11s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .numpad-btn.focused {
            transform: scale(1.12) translate3d(0, 0, 0) !important;
          }
          .numpad-btn.focused div {
            background-color: #ffffff !important;
            border-color: #ffffff !important;
            color: #0d0f11 !important;
          }
          .numpad-btn:active {
            transform: scale(0.95) translate3d(0, 0, 0) !important;
          }
          .cancel-btn {
            border-radius: 50px !important;
            will-change: transform;
            transform: translate3d(0, 0, 0) !important;
            transition: transform 0.11s cubic-bezier(0.16, 1, 0.3, 1) !important;
          }
          .cancel-btn.focused {
            transform: scale(1.06) translate3d(0, 0, 0) !important;
          }
          .cancel-btn.focused div {
            background-color: rgba(255, 255, 255, 0.2) !important;
            border-color: rgba(255, 255, 255, 0.4) !important;
            color: #ffffff !important;
          }
          .cancel-btn:active {
            transform: scale(0.95) translate3d(0, 0, 0) !important;
          }
        `}</style>

        <div style={styles.pinCard}>
          <div style={styles.pinAvatarWrapper}>
            <img
              src={selectedUser.avatar}
              alt={selectedUser.name}
              style={styles.pinAvatar}
            />
            {selectedUser.protected && (
              <div style={styles.pinLockBadge}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" style={{ display: 'block' }}>
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
              </div>
            )}
          </div>
          <h2 style={styles.pinTitle}>Enter PIN for {selectedUser.name}</h2>

          <div style={styles.pinDisplay}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={pin.length > i ? styles.pinDotFilled : styles.pinDotEmpty}>
                {pin.length > i && <span style={styles.pinDotInner}></span>}
              </div>
            ))}
          </div>

          <div style={styles.pinErrorContainer}>
            {pinError && <p style={styles.pinError}>{pinError}</p>}
          </div>

          <div style={styles.numpad}>
            {[1, 2, 3].map((num, index) => (
              <FocusableItem
                key={num}
                id={`numpad-${num}`}
                rowIndex={0}
                colIndex={index}
                onClick={() => {
                  if (pin.length < 4) {
                    const newPin = pin + num
                    setPin(newPin)
                    if (newPin.length === 4) {
                      setTimeout(() => handlePinSubmit(newPin), 200)
                    }
                  }
                }}
                className="numpad-btn"
              >
                <div style={styles.numButton}>{num}</div>
              </FocusableItem>
            ))}

            {[4, 5, 6].map((num, index) => (
              <FocusableItem
                key={num}
                id={`numpad-${num}`}
                rowIndex={1}
                colIndex={index}
                onClick={() => {
                  if (pin.length < 4) {
                    const newPin = pin + num
                    setPin(newPin)
                    if (newPin.length === 4) {
                      setTimeout(() => handlePinSubmit(newPin), 200)
                    }
                  }
                }}
                className="numpad-btn"
              >
                <div style={styles.numButton}>{num}</div>
              </FocusableItem>
            ))}

            {[7, 8, 9].map((num, index) => (
              <FocusableItem
                key={num}
                id={`numpad-${num}`}
                rowIndex={2}
                colIndex={index}
                onClick={() => {
                  if (pin.length < 4) {
                    const newPin = pin + num
                    setPin(newPin)
                    if (newPin.length === 4) {
                      setTimeout(() => handlePinSubmit(newPin), 200)
                    }
                  }
                }}
                className="numpad-btn"
              >
                <div style={styles.numButton}>{num}</div>
              </FocusableItem>
            ))}

            {/* Empty space, 0 button, Delete button */}
            <div></div>
            <FocusableItem
              id="numpad-0"
              rowIndex={3}
              colIndex={1}
              onClick={() => {
                if (pin.length < 4) {
                  const newPin = pin + 0
                  setPin(newPin)
                  if (newPin.length === 4) {
                    setTimeout(() => handlePinSubmit(newPin), 200)
                  }
                }
              }}
              className="numpad-btn"
            >
              <div style={styles.numButton}>0</div>
            </FocusableItem>
            <FocusableItem
              id="numpad-delete"
              rowIndex={3}
              colIndex={2}
              onClick={() => {
                setPin(prev => prev.slice(0, -1))
              }}
              className="numpad-btn"
            >
              <div style={{
                ...styles.numButton,
                backgroundColor: 'rgba(234, 67, 53, 0.12)',
                borderColor: 'rgba(234, 67, 53, 0.25)',
                color: '#ff8080'
              }}>
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                  <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"></path>
                  <line x1="18" y1="9" x2="12" y2="15"></line>
                  <line x1="12" y1="9" x2="18" y2="15"></line>
                </svg>
              </div>
            </FocusableItem>
          </div>

          <div style={styles.cancelRow}>
            <FocusableItem
              id="cancel-btn"
              rowIndex={4}
              colIndex={1}
              onClick={handlePinCancel}
              className="cancel-btn"
            >
              <div style={styles.cancelButton}>Cancel</div>
            </FocusableItem>
          </div>
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
        .user-item {
          will-change: transform;
          transform: translate3d(0, 0, 0) !important;
          transition: transform 0.11s cubic-bezier(0.16, 1, 0.3, 1) !important;
          border-radius: 50%;
        }
        .user-item.focused {
          transform: scale(1.08) translate3d(0, 0, 0) !important;
        }
        .user-item.focused .user-avatar {
          border-color: #ffffff !important;
        }
        .user-item.focused .user-name {
          color: #ffffff !important;
        }
        .user-item:active {
          transform: scale(0.95) translate3d(0, 0, 0) !important;
        }
      `}</style>

      <div style={styles.content}>
        <h1 style={styles.title}>Who's watching?</h1>
        <p style={styles.subtitle}>Select a profile to customize your experience</p>

        <div style={styles.userGrid}>
          {users.map((user, index) => (
            <FocusableItem
              key={user.id}
              id={`user-${user.id}`}
              rowIndex={0}
              colIndex={index}
              onClick={() => handleUserClick(user)}
              className="user-item"
            >
              <div style={styles.userCard}>
                <div style={styles.avatarWrapper}>
                  <img
                    src={user.avatar}
                    alt={user.name}
                    style={styles.avatar}
                    className="user-avatar"
                  />
                  {user.protected && (
                    <div style={styles.lockIcon}>
                      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={PLEX_YELLOW} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ display: 'block' }}>
                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                        <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                      </svg>
                    </div>
                  )}
                </div>
                <p style={styles.userName} className="user-name">{user.name}</p>
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
    minHeight: '100vh',
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
  userGrid: {
    display: 'flex',
    gap: '65px',
    justifyContent: 'center',
    flexWrap: 'wrap',
    alignItems: 'center'
  },
  userCard: {
    cursor: 'pointer',
    textAlign: 'center',
    transition: 'transform 0.3s ease',
  },
  avatarWrapper: {
    position: 'relative',
    marginBottom: '30px'
  },
  avatar: {
    width: '260px',
    height: '260px',
    borderRadius: '50%',
    border: '4px solid rgba(255, 255, 255, 0.1)',
    objectFit: 'cover',
    transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
  },
  lockIcon: {
    position: 'absolute',
    bottom: '5px',
    right: '5px',
    background: '#1d2024',
    borderRadius: '50%',
    width: '64px',
    height: '64px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `3px solid ${PLEX_YELLOW}`,
    boxShadow: '0 4px 15px rgba(0, 0, 0, 0.4)'
  },
  userName: {
    fontSize: '36px',
    color: '#e8eaed',
    fontWeight: '600',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    transition: 'color 0.25s ease'
  },
  spinnerContainer: {
    textAlign: 'center'
  },
  spinnerText: {
    fontSize: '32px',
    color: '#bdc1c6',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },

  // PIN code dialog overlays
  pinCard: {
    padding: '50px 60px 40px',
    background: 'rgba(25, 25, 30, 0.95)',
    border: '1.5px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '32px',
    textAlign: 'center',
    width: '800px',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center'
  },
  pinAvatarWrapper: {
    position: 'relative',
    marginBottom: '20px',
  },
  pinAvatar: {
    width: '140px',
    height: '140px',
    borderRadius: '50%',
    border: `3.5px solid ${PLEX_YELLOW}`,
    objectFit: 'cover'
  },
  pinLockBadge: {
    position: 'absolute',
    bottom: '0',
    right: '0',
    background: '#1d2024',
    borderRadius: '50%',
    width: '44px',
    height: '44px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `2px solid ${PLEX_YELLOW}`
  },
  pinTitle: {
    fontSize: '38px',
    color: '#ffffff',
    marginBottom: '25px',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    fontWeight: '700'
  },
  pinDisplay: {
    display: 'flex',
    gap: '24px',
    justifyContent: 'center',
    marginBottom: '15px'
  },
  pinDotEmpty: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    border: '3px solid rgba(255, 255, 255, 0.25)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.15s ease'
  },
  pinDotFilled: {
    width: '54px',
    height: '54px',
    borderRadius: '50%',
    border: `3px solid ${PLEX_YELLOW}`,
    backgroundColor: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: `0 0 20px rgba(255, 255, 255, 0.55)`,
    transition: 'all 0.15s ease'
  },
  pinDotInner: {
    width: '22px',
    height: '22px',
    borderRadius: '50%',
    backgroundColor: PLEX_YELLOW
  },
  pinErrorContainer: {
    minHeight: '44px',
    marginBottom: '20px'
  },
  pinError: {
    fontSize: '28px',
    color: '#ea4335',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    fontWeight: '600'
  },
  numpad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '24px',
    width: '460px',
    margin: '0 auto 30px'
  },
  numButton: {
    fontSize: '38px',
    width: '100px',
    height: '100px',
    borderRadius: '50%',
    background: 'rgba(255, 255, 255, 0.05)',
    color: '#ffffff',
    border: '1.5px solid rgba(255, 255, 255, 0.08)',
    cursor: 'pointer',
    fontWeight: '700',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  cancelRow: {
    display: 'flex',
    justifyContent: 'center'
  },
  cancelButton: {
    fontSize: '28px',
    padding: '16px 80px',
    background: 'transparent',
    color: '#9aa0a6',
    border: '2.5px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '50px',
    cursor: 'pointer',
    fontWeight: '600',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    transition: 'all 0.2s ease'
  }
}

export default UserSelectPage
