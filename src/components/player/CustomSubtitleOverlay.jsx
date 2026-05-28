import React, { useEffect, useState, useRef } from 'react';
import './CustomSubtitleOverlay.css';

export function CustomSubtitleOverlay({ cues, videoRef }) {
    const [activeCues, setActiveCues] = useState([]);
    const requestRef = useRef();

    useEffect(() => {
        if (!cues || cues.length === 0 || !videoRef.current) {
            setActiveCues([]);
            return;
        }

        const updateCues = () => {
            if (videoRef.current) {
                const currentTime = videoRef.current.currentTime;
                // Find all cues where current time is between start and end
                const current = cues.filter(cue => currentTime >= cue.start && currentTime <= cue.end);
                
                // Only update state if cues changed to avoid re-rendering loop
                setActiveCues(prev => {
                    if (prev.length !== current.length) return current;
                    const isSame = prev.every((c, i) => c.text === current[i].text);
                    return isSame ? prev : current;
                });
            }
            requestRef.current = requestAnimationFrame(updateCues);
        };

        requestRef.current = requestAnimationFrame(updateCues);

        return () => {
            if (requestRef.current) {
                cancelAnimationFrame(requestRef.current);
            }
        };
    }, [cues, videoRef]);

    if (!activeCues || activeCues.length === 0) return null;

    return (
        <div className="custom-subtitle-overlay">
            <div className="subtitle-container">
                {activeCues.map((cue, idx) => (
                    <div key={idx} className="subtitle-line">
                        {cue.text}
                    </div>
                ))}
            </div>
        </div>
    );
}
