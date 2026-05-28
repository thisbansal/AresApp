/**
 * Converts various subtitle formats to WebVTT for native browser rendering
 */

const convertSrtToVtt = (srtContent) => {
    // Replace commas with dots in timestamps
    // SRT: 00:00:01,000 --> 00:00:02,000
    // VTT: 00:00:01.000 --> 00:00:02.000
    let vtt = 'WEBVTT\n\n';
    const lines = srtContent.replace(/\r\n/g, '\n').split('\n');
    
    for (let i = 0; i < lines.length; i++) {
        let line = lines[i];
        
        // Match timestamp line
        if (line.match(/^\d{2}:\d{2}:\d{2},\d{3} --> \d{2}:\d{2}:\d{2},\d{3}$/)) {
            line = line.replace(/,/g, '.');
        }
        
        vtt += line + '\n';
    }
    return vtt;
};

const convertAssToVtt = (assContent) => {
    let vtt = 'WEBVTT\n\n';
    const lines = assContent.replace(/\r\n/g, '\n').split('\n');
    let insideEvents = false;
    let format = [];
    
    for (let line of lines) {
        if (line.startsWith('[Events]')) {
            insideEvents = true;
            continue;
        }
        
        if (insideEvents && line.startsWith('Format:')) {
            format = line.substring(7).trim().split(',').map(s => s.trim());
            continue;
        }
        
        if (insideEvents && line.startsWith('Dialogue:')) {
            const dialogueArgs = line.substring(9).trim().split(',');
            // The text itself might contain commas, so we map up to the number of format args minus 1,
            // then join the rest as the text.
            
            if (dialogueArgs.length < format.length) continue;
            
            const startIdx = format.indexOf('Start');
            const endIdx = format.indexOf('End');
            const textIdx = format.indexOf('Text');
            
            if (startIdx === -1 || endIdx === -1 || textIdx === -1) continue;
            
            // Extract and pad timestamps. ASS is h:mm:ss.cc (centiseconds)
            // VTT needs hh:mm:ss.ttt (milliseconds)
            const formatAssTime = (t) => {
                let parts = t.split(':');
                if (parts.length < 3) return '00:00:00.000';
                
                let h = parts[0].padStart(2, '0');
                let m = parts[1].padStart(2, '0');
                
                let sParts = parts[2].split('.');
                let s = sParts[0].padStart(2, '0');
                let ms = (sParts[1] ? sParts[1].padEnd(3, '0') : '000').substring(0, 3);
                
                return `${h}:${m}:${s}.${ms}`;
            };
            
            const start = formatAssTime(dialogueArgs[startIdx].trim());
            const end = formatAssTime(dialogueArgs[endIdx].trim());
            
            // Text includes everything after the required format fields
            let text = dialogueArgs.slice(textIdx).join(',');
            
            // Strip out all {...} ASS override tags
            text = text.replace(/\{[^}]+\}/g, '');
            // Replace ASS line breaks \N or \n with true newline
            text = text.replace(/\\N/g, '\n').replace(/\\n/g, '\n');
            
            if (text.trim().length > 0) {
                vtt += `${start} --> ${end}\n${text.trim()}\n\n`;
            }
        }
    }
    
    return vtt;
};

export const subtitleConverter = {
    /**
     * Converts a raw subtitle string into a WebVTT Blob URL
     * @param {string} content - The raw subtitle string
     * @param {string} codec - e.g. 'srt', 'ass', 'ssa'
     * @returns {string|null} - A blob URL containing the WebVTT, or null if failed
     */
    convertToVttBlobUrl: (content, codec) => {
        try {
            codec = (codec || '').toLowerCase();
            let vttContent = '';
            
            if (codec === 'srt' || codec === 'subrip') {
                vttContent = convertSrtToVtt(content);
            } else if (codec === 'ass' || codec === 'ssa') {
                vttContent = convertAssToVtt(content);
            } else if (codec === 'vtt' || codec === 'webvtt') {
                vttContent = content; // Already VTT
            } else {
                console.warn(`[SubtitleConverter] Unsupported codec for sidecar conversion: ${codec}`);
                return null;
            }
            
            const blob = new Blob([vttContent], { type: 'text/vtt' });
            return URL.createObjectURL(blob);
        } catch (e) {
            console.error('[SubtitleConverter] Failed to convert subtitle:', e);
            return null;
        }
    }
};
