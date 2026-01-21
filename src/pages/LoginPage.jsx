import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

function LoginPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [code, setCode] = useState('')
  const [qrUrl, setQrUrl] = useState('')
  const [error, setError] = useState('')
  const [polling, setPolling] = useState(false)

  useEffect(() => {
    generatePin()
  }, [])

  const generatePin = async () => {
    try {
      setLoading(true)
      setError('')

      const data = {
        code: 'PZ1Q',
        qr: 'https://placehold.co/400x400/333/fff?text=QR+Code'
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

      setCode(data.code)
      setQrUrl(data.qr)
      setLoading(false)

      // Start polling after PIN is displayed
      startPolling()
    } catch (err) {
      setError(err.message)
      setLoading(false)
    }
  }

  const startPolling = () => {
    setPolling(true)

    // Mock: simulate user signing in after 5 seconds
    setTimeout(() => {
      console.log('User authenticated! Navigating to user selection...')
      navigate('/user-select')
    }, 5000) // 5 seconds for testing
  }

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.spinner}>Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.error}>
          <p style={styles.errorText}>Error: {error}</p>
          <button style={styles.button} onClick={generatePin}>Try Again</button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.container}>
      <div style={styles.content}>
        <h1 style={styles.title}>Sign in to Plex</h1>

        <div style={styles.row}>
          <div style={styles.codeSection}>
            <p style={styles.label}>Your code:</p>
            <p style={styles.code}>{code}</p>
            <p style={styles.hint}>Go to plex.tv/link</p>
            {polling && (
              <p style={styles.polling}>Waiting for authentication...</p>
            )}
          </div>

          <div style={styles.divider} />

          <div style={styles.qrSection}>
            <p style={styles.label}>Or scan this QR code:</p>
            <img src={qrUrl} alt="QR Code" style={styles.qr} />
          </div>
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
    minHeight: '100vh',
    padding: '80px'
  },
  content: {
    textAlign: 'center',
    maxWidth: '1400px',
    width: '100%'
  },
  title: {
    fontSize: '96px',
    marginBottom: '120px',
    fontWeight: 'bold',
    color: '#e8eaed'
  },
  row: {
    display: 'flex',
    gap: '120px',
    justifyContent: 'center',
    alignItems: 'center'
  },
  codeSection: {
    flex: 1,
    textAlign: 'center'
  },
  qrSection: {
    flex: 1,
    textAlign: 'center'
  },
  divider: {
    width: '2px',
    height: '400px',
    background: '#3c3f43'
  },
  label: {
    fontSize: '36px',
    marginBottom: '40px',
    color: '#9aa0a6',
    fontWeight: '500'
  },
  code: {
    fontSize: '144px',
    fontWeight: 'bold',
    letterSpacing: '24px',
    margin: '40px 0',
    color: '#e8eaed'
  },
  hint: {
    fontSize: '32px',
    color: '#9aa0a6',
    marginTop: '40px'
  },
  polling: {
    fontSize: '28px',
    color: '#9aa0a6',
    marginTop: '40px',
    fontStyle: 'italic'
  },
  qr: {
    width: '400px',
    height: '400px',
    border: '4px solid #3c3f43',
    borderRadius: '12px',
    marginTop: '20px'
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
    color: '#ea4335',
    marginBottom: '40px'
  },
  button: {
    fontSize: '32px',
    padding: '20px 60px',
    background: '#ea4335',
    color: '#e8eaed',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    fontWeight: 'bold'
  }
}

export default LoginPage