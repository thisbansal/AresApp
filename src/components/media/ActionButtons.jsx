import React from 'react'
import { FocusableItem } from '../navigational/FocusableItem'

export default function ActionButtons({ onPlay, onRestart, onMore, onFocus, rowIndex = 0 }) {
  const playLabel = onRestart ? 'Resume' : 'Play'
  
  let currentCol = 0
  const playCol = currentCol++
  const restartCol = onRestart ? currentCol++ : null
  const moreCol = onMore ? currentCol++ : null

  return (
    <div style={styles.container}>
      <FocusableItem
        id="btn-play"
        rowIndex={rowIndex}
        colIndex={playCol}
        onClick={onPlay}
        onFocus={onFocus}
        className="action-btn"
      >
        <div style={{ ...styles.button, ...styles.playButton }}>
          <span style={styles.icon}>▶</span> {playLabel}
        </div>
      </FocusableItem>

      {onRestart && (
        <FocusableItem
          id="btn-restart"
          rowIndex={rowIndex}
          colIndex={restartCol}
          onClick={onRestart}
          onFocus={onFocus}
          className="action-btn"
        >
          <div style={{ ...styles.button, ...styles.moreButton }}>
            <span style={{ ...styles.icon, marginRight: '8px' }}>↺</span> Restart
          </div>
        </FocusableItem>
      )}
      
      {onMore && (
        <FocusableItem
          id="btn-more"
          rowIndex={rowIndex}
          colIndex={moreCol}
          onClick={onMore}
          onFocus={onFocus}
          className="action-btn"
        >
          <div style={{ ...styles.button, ...styles.moreButton }}>
            More Info
          </div>
        </FocusableItem>
      )}

      <style>{`
        .action-btn {
          border-radius: 9999px;
        }
        .action-btn.focused > div {
          transform: scale(1.05);
          box-shadow: 0 10px 30px rgba(255, 255, 255, 0.3);
          background-color: rgba(255, 255, 255, 1) !important;
          color: #000 !important;
          border-color: #fff !important;
        }
      `}</style>
    </div>
  )
}

const styles = {
  container: {
    display: 'flex',
    gap: '20px',
    marginTop: '30px',
    marginBottom: '40px',
  },
  button: {
    padding: '14px 40px',
    borderRadius: '9999px',
    fontSize: '22px',
    fontWeight: '600',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    cursor: 'pointer',
  },
  playButton: {
    backgroundColor: '#fff',
    color: '#000',
    border: '1px solid #fff',
  },
  moreButton: {
    backgroundColor: 'rgba(20, 20, 20, 0.75)',
    color: '#fff',
    border: '1px solid rgba(255, 255, 255, 0.2)',
  },
  icon: {
    fontSize: '20px',
  }
}
