import { useEffect, useState } from 'react'

/**
 * SplashScreen Component
 *
 * Shows during app initialization with progress updates
 */
export function SplashScreen({ progress = 0, status = 'Loading...' }) {
  const [dots, setDots] = useState('')

  // Animated dots
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => prev.length >= 3 ? '' : prev + '.')
    }, 500)

    return () => clearInterval(interval)
  }, [])

  return (
    <div style={styles.container}>
      {/* Logo */}
      <div style={styles.logoContainer}>
        <div style={styles.logo}>PLEX</div>
        <div style={styles.tagline}></div>
      </div>

      {/* Progress bar */}
      <div style={styles.progressContainer}>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${progress}%`
            }}
          />
        </div>
        <div style={styles.progressText}>
          {progress}%
        </div>
      </div>

      {/* Status */}
      <div style={styles.status}>
        {status}{dots}
      </div>

      {/* Hint */}
      <div style={styles.hint}>
        This may take a moment on first launch
      </div>
    </div>
  )
}

const PLEX_YELLOW = '#959595'

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100vh',
    background: 'linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%)',
    color: '#e8eaed',
    gap: '40px',
  },
  logoContainer: {
    textAlign: 'center',
    marginBottom: '60px',
  },
  logo: {
    fontSize: '120px',
    fontWeight: 'bold',
    color: PLEX_YELLOW,
    letterSpacing: '8px',
    marginBottom: '20px',
    textShadow: `0 0 30px ${PLEX_YELLOW}40`,
  },
  tagline: {
    fontSize: '36px',
    color: '#9aa0a6',
    letterSpacing: '2px',
  },
  progressContainer: {
    width: '600px',
    display: 'flex',
    flexDirection: 'column',
    gap: '15px',
  },
  progressBar: {
    width: '100%',
    height: '12px',
    background: '#3c3f43',
    borderRadius: '6px',
    overflow: 'hidden',
    border: `2px solid ${PLEX_YELLOW}40`,
  },
  progressFill: {
    height: '100%',
    background: `linear-gradient(90deg, ${PLEX_YELLOW} 0%, #ffc107 100%)`,
    transition: 'width 0.3s ease',
    boxShadow: `0 0 20px ${PLEX_YELLOW}80`,
  },
  progressText: {
    fontSize: '32px',
    color: PLEX_YELLOW,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  status: {
    fontSize: '28px',
    color: '#e8eaed',
    minHeight: '40px',
    textAlign: 'center',
  },
  hint: {
    fontSize: '22px',
    color: '#666',
    marginTop: '40px',
  },
}