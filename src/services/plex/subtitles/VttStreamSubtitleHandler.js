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
   * @param {Function} setTextCallback - A function (text) => void to display subtitles
   * @param {Function} onCachingStateChange - A function (isCaching) => void to handle stream status
   */
  constructor(getTimeCallback, setTextCallback, onCachingStateChange) {
    this.getTimeCallback = getTimeCallback;
    this.setTextCallback = setTextCallback;
    this.onCachingStateChange = onCachingStateChange;
    
    this.cues = [];
    this.activeCue = null;
    this.reader = null;
    
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
    if (this.setTextCallback) {
      this.setTextCallback('');
    }
  }

  async start(url) {
    if (this.abortController) {
      this.abortController.abort();
    }
    this.abortController = new AbortController();
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
        const currentAbsoluteTime = this.getTimeCallback ? this.getTimeCallback() : 0;
        
        // If the cue is more than 5 seconds behind the video clock, we are still caching!
        if (this.onCachingStateChange) {
          if (cue.end < currentAbsoluteTime - 5) {
            this.onCachingStateChange(true);
          } else {
            this.onCachingStateChange(false);
          }
        }
        
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
    if (!this.setTextCallback) {
      return;
    }
    
    // Resolve absolute movie time via injected dependency
    const time = this.getTimeCallback();
    
    // Find active cue using standard array find
    const newCue = this.cues.find(c => time >= c.start && time <= c.end) || null;

    if (newCue !== this.activeCue) {
      this.activeCue = newCue;
      
      // Update Presentation Layer via Inversion of Control
      if (newCue) {
        this.setTextCallback(newCue.text);
      } else {
        this.setTextCallback('');
      }
    }
  }
}
