import React from 'react';
import { FocusableItem } from '../../navigational/FocusableItem';

export function AudioMenu({ availableStreams, activeMenu, handleStreamSelect, getStreamSupport, setActiveMenu }) {
  if (activeMenu !== 'audio') return null;

  const audioStreams = availableStreams.filter(s => s.streamType === 2);

  return (
    <>
      {audioStreams.map((stream, idx) => {
        const supportInfo = getStreamSupport(2, stream.id);
        const isPassthrough = supportInfo?.canPlayValue === 'passthrough-override';
        const isNative = supportInfo?.supported && !isPassthrough;

        return (
          <FocusableItem
            key={stream.id}
            id={`stream-audio-${stream.id}`}
            rowIndex={-1} colIndex={idx}
            className="hud-stream-menu-item player-hud-stream-menu-item"
            onClick={() => {
              handleStreamSelect(2, stream.id);
              setActiveMenu('none');
            }}
          >
            <div style={{ backgroundColor: stream.selected ? '#fff' : 'transparent'}} className="player-hud-stream-radio" />
            <span style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>{stream.displayTitle || stream.language || stream.codec || `Stream ${stream.id}`}</span>
            </span>
          </FocusableItem>
        );
      })}
    </>
  );
}
