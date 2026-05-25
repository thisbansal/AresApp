import React from 'react'
import { useSpatialNavigation } from '../../contexts/SpatialNavigationContext'
import { FocusableItem } from './FocusableItem'

export function ExitDialog() {
  const { showExitDialog, setShowExitDialog } = useSpatialNavigation()

  const handleExitApp = () => {
    console.log('[ExitDialog] Closing application...')
    if (window.close) {
      window.close()
    }
    if (window.webOS && window.webOS.toApp) {
      window.webOS.toApp('close')
    }
  }

  if (!showExitDialog) return null

  return (
    <div style={styles.exitOverlay} className="exit-overlay">
      <div style={styles.exitModal} className="exit-modal">
        <span style={styles.exitTitle}>Are you sure you want to exit?</span>

        <div style={styles.exitButtonRow}>
          {/* Cancel Button */}
          <FocusableItem
            id="exit-cancel"
            rowIndex={999}
            colIndex={0}
            onClick={() => {
              setShowExitDialog(false)
            }}
            className="exit-btn cancel"
          >
            Cancel
          </FocusableItem>

          {/* Exit Button */}
          <FocusableItem
            id="exit-exit"
            rowIndex={999}
            colIndex={1}
            onClick={handleExitApp}
            className="exit-btn confirm"
          >
            Yes
          </FocusableItem>
        </div>
      </div>
    </div>
  )
}

const styles = {
  exitOverlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    zIndex: 999999,
    display: 'flex',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  exitModal: {
    backgroundColor: 'rgba(20, 20, 26, 0.95)',
    border: '1.5px solid rgba(255, 255, 255, 0.15)',
    borderRadius: '9999px',
    boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65)',
    padding: '0 45px',
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '60px',
    height: '100px',
    width: 'auto',
    minWidth: '820px',
    marginBottom: '25vh',
  },
  exitTitle: {
    fontSize: '32px',
    fontWeight: '600',
    color: '#ffffff',
    margin: 0,
    fontFamily: "'Outfit', 'Inter', sans-serif",
    letterSpacing: '-0.3px',
  },
  exitButtonRow: {
    display: 'flex',
    flexDirection: 'row',
    alignItems: 'center',
    gap: '20px',
  }
}
