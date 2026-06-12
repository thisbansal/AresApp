import React from 'react';
import { FocusableItem } from '../../navigational/FocusableItem';

export function VideoMenu({ availableStreams, activeMenu, handleStreamSelect, getStreamSupport }) {
  if (activeMenu !== 'video') return null;

  const videoStreams = availableStreams.filter(s => s.streamType === 1);

  return (
    <>
      {videoStreams.map((stream, idx) => {
        const supportInfo = getStreamSupport(1, stream.id);
        const isNative = supportInfo?.supported;

        return (
          <FocusableItem
            key={stream.id}
            id={`stream-video-${stream.id}`}
            rowIndex={-1} colIndex={idx}
            className="hud-stream-menu-item player-hud-stream-menu-item"
            onClick={() => handleStreamSelect(1, stream.id)}
          >
            <div style={{ backgroundColor: stream.selected ? '#fff' : 'transparent'}} className="player-hud-stream-radio" />
            <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{stream.displayTitle || stream.codec || `Stream ${stream.id}`}</span>
              <span style={{ fontSize: '0.85em', opacity: 0.8, marginLeft: '12px' }}>
                {isNative ? '[Native]' : '[Transcode]'}
              </span>
            </span>
          </FocusableItem>
        );
      })}
    </>
  );
}
