import { useEffect, useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { FocusableItem } from '../components/navigational/FocusableItem'
import { generatePin, checkPinAuth } from '../services/plex/plexAuthService'
import { saveMainToken, getMainToken } from '../services/luna/tokenStorage'

function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [error, setError] = useState('')
  const [polling, setPolling] = useState(false)
  const pinIdRef = useRef(null)
  const pollIntervalRef = useRef(null)

  useEffect(() => {
    initAuth()

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const initAuth = async () => {
    console.log("[AUTH FLOW] LoginPage: Initializing authentication setup...")
    try {
      setLoading(true)
      setError('')

      console.log("[AUTH FLOW] LoginPage: Requesting a new authentication PIN code from Plex...")
      const pin = await generatePin()
      pinIdRef.current = pin.id

      console.log(`[AUTH FLOW] LoginPage: Generated PIN code: "${pin.code}" | Pin ID: ${pin.id}`)
      setCode(pin.code)
      setQrUrl(`https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent('https://plex.tv/link')}`)
      setLoading(false)

      startPolling()
    } catch (err) {
      console.error("[AUTH FLOW] LoginPage: Failed to request PIN:", err)
      setError('Connection failed. Please check your internet connection and try again.')
      setLoading(false)
    }
  }

  const startPolling = () => {
    console.log(`[AUTH FLOW] LoginPage: Started polling for PIN validation (Pin ID: ${pinIdRef.current})...`)
    setPolling(true)

    pollIntervalRef.current = setInterval(async () => {
      try {
        const result = await checkPinAuth(pinIdRef.current)
        console.log("[AUTH FLOW] LoginPage: checkPinAuth raw response:", JSON.stringify(result))

        if (result.authenticated) {
          const maskedToken = result.authToken ? `${result.authToken.substring(0, 4)}...${result.authToken.substring(result.authToken.length - 4)}` : 'null'
          console.log(`[AUTH FLOW] LoginPage: PIN validation succeeded! Received token: ${maskedToken}. Saving main account token...`)
          clearInterval(pollIntervalRef.current)
          
          const saveResult = await saveMainToken(result.authToken)
          console.log("[AUTH FLOW] LoginPage: saveMainToken result:", JSON.stringify(saveResult))

          // Double check by reading back immediately
          try {
            const readBack = await getMainToken()
            const maskedReadBack = readBack ? `${readBack.substring(0, 4)}...${readBack.substring(readBack.length - 4)}` : 'null'
            console.log(`[AUTH FLOW] LoginPage: Immediate readback check resolved token: ${maskedReadBack}`)
          } catch (readBackError) {
            console.error("[AUTH FLOW] LoginPage: Immediate readback check failed with error:", readBackError)
          }

          console.log("[AUTH FLOW] LoginPage: Reloading app instantly now!")
          window.location.reload()
        }
      } catch (err) {
        console.error('[AUTH FLOW] LoginPage: Polling verification error:', err)
      }
    }, 5000)
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinnerContainer}>
          <div className="spinner"></div>
          <p style={styles.spinnerText}>Generating secure link code...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <style>{`
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
            onClick={initAuth}
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
        @keyframes pulse {
          0%, 100% { opacity: 0.5; }
          50% { opacity: 0.9; }
        }
        .pulse-text {
          animation: pulse 2s infinite ease-in-out;
        }
      `}</style>

      <div style={styles.content}>
        <h1 style={styles.title}>Sign in to Plex</h1>
        <p style={styles.subtitle}>Link this TV app to your Plex account</p>

        <div style={styles.row}>
          {/* Code Section */}
          <div style={styles.codeSection}>
            <p style={styles.label}>1. Enter this code on your device:</p>
            <div style={styles.codeContainer}>
              <p style={styles.code}>{code}</p>
            </div>
            <p style={styles.hint}>
              Visit <span style={styles.linkText}>plex.tv/link</span> on your phone or computer
            </p>
            {polling && (
              <div style={styles.pollingContainer} className="pulse-text">
                <span style={styles.pollingDot}></span>
                <p style={styles.polling}>Waiting for link confirmation...</p>
              </div>
            )}
          </div>

          <div style={styles.divider} />

          {/* QR Section */}
          <div style={styles.qrSection}>
            <p style={styles.label}>Or scan with your phone:</p>
            <div style={styles.qrCard}>
              <img src={qrUrl} alt="QR Code" style={styles.qr} />
            </div>
          </div>
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
    marginBottom: '90px',
    fontWeight: '400',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  row: {
    display: 'flex',
    gap: '90px',
    justifyContent: 'center',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: '1300px',
    background: 'rgba(255, 255, 255, 0.02)',
    backdropFilter: 'blur(30px) saturate(180%)',
    WebkitBackdropFilter: 'blur(30px) saturate(180%)',
    border: '1.5px solid rgba(255, 255, 255, 0.08)',
    borderRadius: '32px',
    padding: '70px 80px',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.45)'
  },
  codeSection: {
    flex: 1.1,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    textAlign: 'left'
  },
  qrSection: {
    flex: 0.9,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center'
  },
  divider: {
    width: '1.5px',
    background: 'linear-gradient(to bottom, rgba(255, 255, 255, 0.02), rgba(255, 255, 255, 0.15) 50%, rgba(255, 255, 255, 0.02))'
  },
  label: {
    fontSize: '32px',
    marginBottom: '20px',
    color: '#ffffff',
    fontWeight: '600',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  codeContainer: {
    background: 'rgba(255, 255, 255, 0.03)',
    border: '1px solid rgba(255, 255, 255, 0.06)',
    borderRadius: '16px',
    padding: '15px 40px',
    margin: '20px 0',
    width: 'fit-content',
    boxShadow: 'inset 0 4px 10px rgba(0, 0, 0, 0.2)'
  },
  code: {
    fontSize: '110px',
    fontWeight: '800',
    letterSpacing: '12px',
    color: PLEX_YELLOW,
    fontFamily: "'Outfit', 'Inter', sans-serif",
    margin: 0,
    textShadow: `0 0 35px rgba(255, 255, 255, 0.35)`
  },
  hint: {
    fontSize: '28px',
    color: '#9aa0a6',
    marginTop: '15px',
    fontFamily: "'Outfit', 'Inter', sans-serif",
    fontWeight: '400'
  },
  linkText: {
    color: '#ffffff',
    fontWeight: '600',
    textDecoration: 'underline'
  },
  pollingContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '14px',
    marginTop: '40px',
    padding: '12px 28px',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    border: '1px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '50px',
    width: 'fit-content'
  },
  pollingDot: {
    width: '14px',
    height: '14px',
    backgroundColor: PLEX_YELLOW,
    borderRadius: '50%',
    boxShadow: `0 0 12px rgba(255, 255, 255, 0.65)`
  },
  polling: {
    fontSize: '26px',
    color: PLEX_YELLOW,
    margin: 0,
    fontWeight: '600',
    fontFamily: "'Outfit', 'Inter', sans-serif"
  },
  qrCard: {
    background: '#ffffff',
    padding: '24px',
    borderRadius: '24px',
    boxShadow: '0 15px 35px rgba(0, 0, 0, 0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '4px solid rgba(255, 255, 255, 0.05)'
  },
  qr: {
    width: '280px',
    height: '280px',
    display: 'block'
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

export default LoginPage