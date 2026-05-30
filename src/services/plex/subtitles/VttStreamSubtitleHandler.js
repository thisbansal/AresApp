/**
 * VttStreamSubtitleHandler
 * 
 * A pure logic handler for fetching, parsing, and rendering VTT subtitle streams.
 * It manages its own high-performance 60fps render loop to synchronize subtitles
 * precisely with the video playback, completely detached from React's Virtual DOM.
 */
export class VttStreamSubtitleHandler {
  /**
   * @param {Function} getTimeCallback - Returns the absolute movie time in seconds
   * @param {Object} overlayRef - A React ref object exposing .current.setText(text) and .current.clearText()
   */
  constructor(getTimeCallback, overlayRef) {
    this.getTimeCallback = getTimeCallback;
    this.overlayRef = overlayRef;
    
    this.cues = [];
    this.activeCue = null;
    this.reader = null;
    this.abortController = new AbortController();
    
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
    
    // Start high-performance 60fps render loop
    this.animationFrameId = null;
    this.startRenderLoop();
  }

  startRenderLoop() {
    const loop = () => {
      this.handleTimeUpdate();
      this.animationFrameId = requestAnimationFrame(loop);
    };
    this.animationFrameId = requestAnimationFrame(loop);
  }

  destroy() {
    this.abortController.abort();
    if (this.animationFrameId) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.overlayRef && this.overlayRef.current) {
      this.overlayRef.current.clearText();
    }
  }

  async start(url) {
    this.cues = [];
    this.activeCue = null;
    
    try {
      const response = await fetch(url, { signal: this.abortController.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (!response.body) throw new Error('ReadableStream not supported');

      this.reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { done, value } = await this.reader.read();
        if (done) {
          buffer += decoder.decode();
          this.processBuffer(buffer, true);
          break;
        }

        buffer += decoder.decode(value, { stream: true });
        console.log(`[VttStreamHandler] Received chunk! Size: ${value.length} bytes.`);
        buffer = this.processBuffer(buffer, false);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[VttStreamHandler] Stream manually aborted.');
        return;
      }
      console.error('[VttStreamHandler] Stream failed:', err);
    }
  }

  processBuffer(buffer, isDone) {
    const blocks = buffer.split(/\r?\n\r?\n/);
    
    // If not done, keep the last block in the buffer because it might be incomplete
    let remainingBuffer = '';
    if (!isDone) {
      remainingBuffer = blocks.pop() || '';
    }

    for (const block of blocks) {
      if (!block.trim()) continue;
      const cue = this.parseBlock(block);
      if (cue) {
        const currentAbsoluteTime = this.getTimeCallback ? this.getTimeCallback() : 'unknown';
        console.log(`[VttStreamHandler] Successfully parsed cue: [${cue.start} -> ${cue.end}] "${cue.text}" | Video Clock: ${currentAbsoluteTime}`);
        this.cues.push(cue);
      }
    }
    
    return remainingBuffer;
  }

  parseBlock(block) {
    const lines = block.trim().split(/\r?\n/);
    if (lines.length < 2) return null;

    let timeLineIdx = 0;
    if (lines[timeLineIdx].includes('-->')) {
      timeLineIdx = 0;
    } else if (lines.length > 1 && lines[timeLineIdx + 1].includes('-->')) {
      timeLineIdx = 1;
    } else {
      return null;
    }

    const timeMatch = lines[timeLineIdx].match(/(\d{2}:\d{2}:\d{2}[.,]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[.,]\d{3})/);
    if (!timeMatch) return null;

    const start = this.timeToSeconds(timeMatch[1]);
    const end = this.timeToSeconds(timeMatch[2]);
    const text = lines.slice(timeLineIdx + 1).join('\n').replace(/<[^>]+>/g, ''); // strip tags

    return { start, end, text };
  }

  timeToSeconds(timeStr) {
    const parts = timeStr.replace(',', '.').split(':');
    let seconds = 0;
    if (parts.length === 3) {
      seconds = parseFloat(parts[0]) * 3600 + parseFloat(parts[1]) * 60 + parseFloat(parts[2]);
    } else if (parts.length === 2) {
      seconds = parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
    }
    return seconds;
  }

  handleTimeUpdate() {
    if (!this.overlayRef) {
      console.warn('[VttStreamHandler] overlayRef is entirely undefined');
      return;
    }
    if (!this.overlayRef.current) {
      console.warn('[VttStreamHandler] overlayRef.current is null - component not mounted?');
      return;
    }
    
    // Resolve absolute movie time via injected dependency
    const time = this.getTimeCallback();

    if (this.lastLoggedTime === undefined || Math.abs(time - this.lastLoggedTime) >= 1) {
      console.log(`[VttStreamHandler] Calculated absolute time: ${time}`);
      this.lastLoggedTime = time;
    }

    // Find active cue using standard array find
    const newCue = this.cues.find(c => time >= c.start && time <= c.end) || null;

    if (newCue !== this.activeCue) {
      this.activeCue = newCue;
      
      // Update Presentation Layer via Inversion of Control
      if (newCue) {
        console.log(`[VttStreamHandler] Calling setText with: "${newCue.text}" at time ${time}`);
        this.overlayRef.current.setText(newCue.text);
      } else {
        // console.log(`[VttStreamHandler] Clearing text at time ${time}`);
        this.overlayRef.current.clearText();
      }
    }
  }
}
