import React from 'react'

export const ServerOfflineMessage = () => {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '60px 80px',
      backgroundColor: 'rgba(20, 20, 20, 0.85)',
      borderRadius: '30px',
      boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
      margin: '0 auto',
      maxWidth: '600px'
    }}>
      <h2 style={{
        fontSize: '42px',
        fontWeight: '800',
        color: '#ffffff',
        marginBottom: '15px',
        fontFamily: '"Outfit", "Inter", sans-serif'
      }}>
        Plex Server Took a Nap
      </h2>
      <p style={{
        fontSize: '22px',
        color: '#a8a8af',
        marginBottom: '0',
        lineHeight: '1.4'
      }}>
        We lost connection to your server. It's either updating, offline, or just ignoring us.
      </p>
    </div>
  )
}
