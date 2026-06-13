import React from 'react';
import { FocusableItem } from '../../navigational/FocusableItem';

export function SubtitleMenu({ 
  availableStreams, 
  activeMenu, 
  handleStreamSelect, 
  getStreamSupport,
  isSubtitleVisible,
  setIsSubtitleVisible
}) {
  if (activeMenu !== 'subtitle') return null;

  const subtitleStreams = availableStreams.filter(s => s.streamType === 3);

  return (
    <>

      <FocusableItem
        id="stream-sub-toggle"
        rowIndex={-1} colIndex={1}
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)', marginBottom: '8px', paddingBottom: '12px'}}
        className="hud-stream-menu-item player-hud-stream-menu-item"
        onClick={() => setIsSubtitleVisible(!isSubtitleVisible)}
      >
        <div style={{ borderRadius: '2px', backgroundColor: isSubtitleVisible ? '#fff' : 'transparent'}} className="player-hud-stream-radio" />
        <span style={{ flex: 1 }}>{isSubtitleVisible ? "Hide Subtitles" : "Show Subtitles"}</span>
      </FocusableItem>

      {subtitleStreams.map((stream, idx) => {
        const supportInfo = getStreamSupport(3, stream.id);
        const isNative = supportInfo?.supported;

        return (
          <FocusableItem
            key={stream.id}
            id={`stream-subtitle-${stream.id}`}
            rowIndex={-1} colIndex={idx + 2}
            className="hud-stream-menu-item player-hud-stream-menu-item"
            onClick={() => {
              handleStreamSelect(3, stream.id);
              if (!isSubtitleVisible) setIsSubtitleVisible(true);
            }}
          >
            <div style={{ backgroundColor: stream.selected ? '#fff' : 'transparent'}} className="player-hud-stream-radio" />
            <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{stream.displayTitle || stream.language || stream.codec || `Stream ${stream.id}`}</span>
              <span style={{ fontSize: '0.85em', opacity: 0.8, marginLeft: '12px' }}>
                {isNative ? '[Native]' : '[Burn-in]'}
              </span>
            </span>
          </FocusableItem>
        );
      })}
    </>
  );
}
