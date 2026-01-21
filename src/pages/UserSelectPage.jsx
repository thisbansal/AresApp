import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'

function UserSelectPage() {
  const navigate = useNavigate()
  const [selectedUser, setSelectedUser] = useState(null)
  const [showPinPrompt, setShowPinPrompt] = useState(false)
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState('')

  // Mock users
  const users = [
    {
      id: 1,
      name: 'John Doe',
      avatar: 'https://i.pravatar.cc/300?img=12',
      protected: true,
      pin: '1234'
    },
    {
      id: 2,
      name: 'Jane Smith',
      avatar: 'https://i.pravatar.cc/300?img=5',
      protected: false
    },
    {
      id: 3,
      name: 'Kids',
      avatar: 'https://i.pravatar.cc/300?img=8',
      protected: true,
      pin: '0000'
    }
  ]

  const handleUserClick = (user) => {
    setSelectedUser(user)

    if (user.protected) {
      setShowPinPrompt(true)
      setPin('')
      setPinError('')
    } else {
      navigate('/home')
    }
  }

  const handlePinSubmit = () => {
    if (pin === selectedUser.pin) {
      navigate('/home')
    } else {
      setPinError('Incorrect PIN. Try again.')
      setPin('')
    }
  }

  const handlePinCancel = () => {
    setShowPinPrompt(false)
    setSelectedUser(null)
    setPin('')
    setPinError('')
  }

    if (showPinPrompt) {
    return (
        <div style={styles.container}>
        <div style={styles.pinPrompt}>
            <img
            src={selectedUser.avatar}
            alt={selectedUser.name}
            style={styles.pinAvatar}
            />
            <h2 style={styles.pinTitle}>Enter PIN for {selectedUser.name}</h2>

            <div style={styles.pinDisplay}>
            {[0, 1, 2, 3].map(i => (
                <div key={i} style={styles.pinDot}>
                {pin.length > i ? '●' : '○'}
                </div>
            ))}
            </div>

            {pinError && <p style={styles.pinError}>{pinError}</p>}

            <div style={styles.numpad}>
            {/* Row 1: 1, 2, 3 */}
            {[1, 2, 3].map((num) => (
                <FocusableItem
                key={num}
                id={`numpad-${num}`}
                rowIndex={0}
                colIndex={num - 1}
                onClick={() => {
                    if (pin.length < 4) {
                    const newPin = pin + num
                    setPin(newPin)
                    if (newPin.length === 4) {
                        setTimeout(() => {
                        if (newPin === selectedUser.pin) {
                            navigate('/home')
                        } else {
                            setPinError('Incorrect PIN. Try again.')
                            setPin('')
                        }
                        }, 200)
                    }
                    }
                }}
                >
                <div style={styles.numButton}>{num}</div>
                </FocusableItem>
            ))}

            {/* Row 2: 4, 5, 6 */}
            {[4, 5, 6].map((num) => (
                <FocusableItem
                key={num}
                id={`numpad-${num}`}
                rowIndex={1}
                colIndex={num - 4}
                onClick={() => {
                    if (pin.length < 4) {
                    const newPin = pin + num
                    setPin(newPin)
                    if (newPin.length === 4) {
                        setTimeout(() => {
                        if (newPin === selectedUser.pin) {
                            navigate('/home')
                        } else {
                            setPinError('Incorrect PIN. Try again.')
                            setPin('')
                        }
                        }, 200)
                    }
                    }
                }}
                >
                <div style={styles.numButton}>{num}</div>
                </FocusableItem>
            ))}

            {/* Row 3: 7, 8, 9 */}
            {[7, 8, 9].map((num) => (
                <FocusableItem
                key={num}
                id={`numpad-${num}`}
                rowIndex={2}
                colIndex={num - 7}
                onClick={() => {
                    if (pin.length < 4) {
                    const newPin = pin + num
                    setPin(newPin)
                    if (newPin.length === 4) {
                        setTimeout(() => {
                        if (newPin === selectedUser.pin) {
                            navigate('/home')
                        } else {
                            setPinError('Incorrect PIN. Try again.')
                            setPin('')
                        }
                        }, 200)
                    }
                    }
                }}
                >
                <div style={styles.numButton}>{num}</div>
                </FocusableItem>
            ))}

            {/* Row 4: 0 (centered) */}
            <div style={styles.zeroRow}>
                <FocusableItem
                id="numpad-0"
                rowIndex={3}
                colIndex={1}
                onClick={() => {
                    if (pin.length < 4) {
                    const newPin = pin + 0
                    setPin(newPin)
                    if (newPin.length === 4) {
                        setTimeout(() => {
                        if (newPin === selectedUser.pin) {
                            navigate('/home')
                        } else {
                            setPinError('Incorrect PIN. Try again.')
                            setPin('')
                        }
                        }, 200)
                    }
                    }
                }}
                >
                <div style={styles.numButton}>0</div>
                </FocusableItem>
            </div>
            </div>

            {/* Row 5: Cancel button */}
            <div style={styles.cancelRow}>
            <FocusableItem
                id="cancel-btn"
                rowIndex={4}
                colIndex={1}
                onClick={handlePinCancel}
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
      <div style={styles.content}>
        <h1 style={styles.title}>Who's watching?</h1>

        <div style={styles.userGrid}>
          {users.map((user, index) => (
            <FocusableItem
              key={user.id}
              id={`user-${user.id}`}
              rowIndex={0}
              colIndex={index}
              onClick={() => handleUserClick(user)}
              className="user-card"
            >
              <div style={styles.userCard}>
                <div style={styles.avatarWrapper}>
                  <img
                    src={user.avatar}
                    alt={user.name}
                    style={styles.avatar}
                  />
                  {user.protected && (
                    <div style={styles.lockIcon}>🔒</div>
                  )}
                </div>
                <p style={styles.userName}>{user.name}</p>
              </div>
            </FocusableItem>
          ))}
        </div>
      </div>
    </div>
  )
}

const PLEX_YELLOW = '#e5a00d'

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',           // Exact viewport height
    padding: '0',              // No padding that adds to height
    overflow: 'hidden'         // Never scroll
  },
  content: {
    textAlign: 'center',
    maxWidth: '1600px',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%'
  },
  title: {
    fontSize: '96px',
    marginBottom: '80px',
    fontWeight: 'bold',
    color: '#e8eaed'
  },
  userGrid: {
    display: 'flex',
    gap: '80px',
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
    width: '280px',
    height: '280px',
    borderRadius: '50%',
    border: `6px solid ${PLEX_YELLOW}`,
    objectFit: 'cover',
    transition: 'transform 0.3s ease, box-shadow 0.3s ease'
  },
  lockIcon: {
    position: 'absolute',
    bottom: '10px',
    right: '10px',
    fontSize: '48px',
    background: '#282a2d',
    borderRadius: '50%',
    width: '80px',
    height: '80px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: `4px solid ${PLEX_YELLOW}`
  },
  userName: {
    fontSize: '42px',
    color: '#e8eaed',
    fontWeight: '500'
  },

  // PIN Prompt styles - using vh units to fit exactly
  pinPrompt: {
    textAlign: 'center',
    maxWidth: '900px',
    height: '100vh',           // Full viewport height
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    padding: '0 40px'
  },
  pinAvatar: {
    width: '12vh',             // 12% of viewport height
    height: '12vh',
    borderRadius: '50%',
    border: `6px solid ${PLEX_YELLOW}`,
    marginBottom: '2vh',
    alignSelf: 'center'
  },
  pinTitle: {
    fontSize: '4vh',           // 4% of viewport height
    color: '#e8eaed',
    marginBottom: '3vh'
  },
  pinDisplay: {
    display: 'flex',
    gap: '3vh',
    justifyContent: 'center',
    marginBottom: '4vh'
  },
  pinDot: {
    fontSize: '5vh',
    color: PLEX_YELLOW,
    width: '6vh',
    height: '6vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  pinError: {
    fontSize: '3vh',
    color: '#ea4335',
    marginBottom: '2vh',
    minHeight: '4vh'          // Reserve space even when empty
  },
  numpad: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '2.5vh',
    maxWidth: '600px',
    margin: '0 auto 3vh',
    padding: '0 60px'
  },
  numButton: {
    fontSize: '4.5vh',
    width: '10vh',             // 10% of viewport height
    height: '10vh',
    borderRadius: '50%',
    background: '#3c3f43',
    color: '#e8eaed',
    border: `4px solid ${PLEX_YELLOW}`,
    cursor: 'pointer',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 0.2s ease'
  },
  zeroRow: {
    gridColumn: '2',
    display: 'flex',
    justifyContent: 'center'
  },
  cancelRow: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: '2vh'
  },
  cancelButton: {
    fontSize: '3vh',
    padding: '2vh 8vh',
    background: 'transparent',
    color: '#9aa0a6',
    border: '3px solid #3c3f43',
    borderRadius: '50px',
    cursor: 'pointer',
    fontWeight: '500'
  }
}

export default UserSelectPage