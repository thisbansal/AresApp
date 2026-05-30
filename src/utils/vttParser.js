/**
 * Parses a WebVTT formatted string into an array of subtitle cue objects.
 * 
 * @param {string} vttString - The raw WebVTT content
 * @returns {Array<{start: number, end: number, text: string}>} Array of parsed cues
 */
export const parseVtt = (vttString) => {
    if (!vttString) return [];
    
    // Normalize newlines
    const normalized = vttString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    const blocks = normalized.split('\n\n');
    
    const cues = [];
    
    // Helper to convert VTT timestamp (HH:MM:SS.mmm or MM:SS.mmm) to seconds
    const timeToSeconds = (timeStr) => {
        if (!timeStr) return 0;
        const parts = timeStr.trim().split(':');
        let seconds = 0;
        
        if (parts.length === 3) {
            // HH:MM:SS.mmm
            seconds += parseInt(parts[0], 10) * 3600;
            seconds += parseInt(parts[1], 10) * 60;
            seconds += parseFloat(parts[2]);
        } else if (parts.length === 2) {
            // MM:SS.mmm
            seconds += parseInt(parts[0], 10) * 60;
            seconds += parseFloat(parts[1]);
        }
        return isNaN(seconds) ? 0 : seconds;
    };

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i].trim();
        if (!block || block === 'WEBVTT') continue;
        
        const lines = block.split('\n');
        
        // Find the timestamp line
        let timeLineIdx = -1;
        for (let j = 0; j < lines.length; j++) {
            if (lines[j].includes('-->')) {
                timeLineIdx = j;
                break;
            }
        }
        
        if (timeLineIdx === -1) continue; // Not a valid cue block
        
        const timeLine = lines[timeLineIdx];
        const [startStr, endStr] = timeLine.split('-->').map(s => s.trim());
        
        const start = timeToSeconds(startStr);
        const end = timeToSeconds(endStr);
        
        // The text is everything after the timestamp line
        const textLines = lines.slice(timeLineIdx + 1);
        const text = textLines.join('\n').trim();
        
        if (text) {
            cues.push({
                start,
                end,
                text
            });
        }
    }
    
    // Sort cues by start time just to be safe
    cues.sort((a, b) => a.start - b.start);
    
    return cues;
};
