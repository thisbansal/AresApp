export class StreamingSubtitleManager {
  constructor(videoElement, overlayElement) {
    this.videoElement = videoElement;
    this.overlayElement = overlayElement;
    this.cues = [];
    this.activeCue = null;
    this.reader = null;
    this.abortController = new AbortController();
    
    this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
    
    // Start high-performance 60fps render loop instead of 4Hz timeupdate
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
    if (this.overlayElement) {
      this.overlayElement.innerText = '';
    }
  }

  async startStream(url) {
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
        console.log(`[Native Subtitles] Received chunk! Size: ${value.length} bytes. Raw text snippet: ${buffer.substring(0, 100)}...`);
        buffer = this.processBuffer(buffer, false);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log('[Native Subtitles] Stream manually aborted.');
        return;
      }
      console.error('[Native Subtitles] Stream failed:', err);
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
        console.log(`[Native Subtitles] Successfully parsed cue: [${cue.start} -> ${cue.end}] "${cue.text}"`);
        this.cues.push(cue);
      } else {
        console.log(`[Native Subtitles] Failed to parse block: \n${block}`);
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
    if (!this.overlayElement) return;
    const time = this.videoElement.currentTime;

    // Find active cue using standard array find
    const newCue = this.cues.find(c => time >= c.start && time <= c.end) || null;

    if (newCue !== this.activeCue) {
      this.activeCue = newCue;
      
      // Update DOM
      this.overlayElement.innerText = newCue ? newCue.text : '';
      
      // Log for debugging
      if (newCue) {
        console.log(`[Native Subtitles] Triggering overlay text at ${time}: "${newCue.text}"`);
      }
    }
  }
}
