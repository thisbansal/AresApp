import { TinyDemuxer } from './tinyDemuxer';
import { PgsRenderer } from 'libpgs';
import workerUrl from 'libpgs/dist/libpgs.worker.js?url';


export class PgsCanvasEngine {
  constructor(videoElement, canvasElement, timeOffsetMs = 0) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    if (this.canvasElement) {
        this.canvasElement.style.position = 'absolute';
        this.canvasElement.style.top = '0';
        this.canvasElement.style.left = '0';
        this.canvasElement.style.width = '100%';
        this.canvasElement.style.height = '100%';
        this.canvasElement.style.pointerEvents = 'none';
        this.canvasElement.style.zIndex = '999999';
    }
    
    this.timeOffsetMs = timeOffsetMs;
    this.pgsRenderer = null;
    this.demuxer = null;
    this.isDisposed = false;
    this.abortController = new AbortController();
    this.chunks = [];
    this.totalBytes = 0;
    this.lastRenderedBytes = 0;
    
    this.lastUrl = null;
    this.lastDecisionUrl = null;
    
    this.handleSeek = this.handleSeek.bind(this);
    if (this.videoElement) {
        this.videoElement.addEventListener('seeked', this.handleSeek);
    }
  }

  async loadStream(url, decisionUrl = null) {
    this.lastUrl = url;
    this.lastDecisionUrl = decisionUrl;
    
    this.abortController = new AbortController();
    this.demuxer = new TinyDemuxer();
    
    const extractHeaders = (urlStr) => {
      const urlObj = new URL(urlStr);
      const headers = { 'Accept': '*/*' };
      const keysToDelete = [];
      for (const [key, value] of urlObj.searchParams.entries()) {
        if (key.startsWith('X-Plex-') || key === 'Accept-Language') {
          headers[key] = value;
          keysToDelete.push(key);
        }
      }
      keysToDelete.forEach(k => urlObj.searchParams.delete(k));
      return { cleanUrl: urlObj.toString(), headers };
    };

    try {
      if (decisionUrl) {
        const dec = extractHeaders(decisionUrl);
        dec.headers['Accept'] = 'application/json';
        console.log('[PgsCanvasEngine] Establishing Plex Transcode Session...', dec.cleanUrl);
        const decRes = await fetch(dec.cleanUrl, { 
          signal: this.abortController.signal,
          headers: dec.headers
        });
        if (!decRes.ok) {
           const errText = await decRes.text();
           console.error('[PgsCanvasEngine] Transcode Session Establishment Failed!', decRes.status, errText);
           throw new Error('Failed to establish Plex Transcode Session');
        }
      }

      const start = extractHeaders(url);
      console.log('[PgsCanvasEngine] Fetching sidecar MKV stream:', start.cleanUrl);
      console.log('[PgsCanvasEngine] Headers being sent:', start.headers);
      
      const response = await fetch(start.cleanUrl, { 
        signal: this.abortController.signal,
        headers: start.headers
      });

      console.log('[PgsCanvasEngine] Fetch response status:', response.status, response.statusText);

      if (!response.ok) {
        console.error('[PgsCanvasEngine] Fetch failed! URL:', start.cleanUrl, 'Status:', response.status);
        throw new Error(`Failed to fetch sidecar stream. Status: ${response.status}`);
      }

      this.demuxer = new TinyDemuxer();
      const reader = response.body.getReader();

      let chunksRead = 0;

      while (!this.isDisposed) {
        const { done, value } = await reader.read();
        if (done) {
          console.log('[PgsCanvasEngine] Stream finished loading entirely.');
          break;
        }

        chunksRead++;
        console.log(`[PgsCanvasEngine] Received chunk #${chunksRead} of size ${value.byteLength} bytes`);


        if (this.isDisposed) break;

        if (!this._firstChunkChecked) {
          this._firstChunkChecked = true;
          const str = new TextDecoder().decode(value.slice(0, 100));
          console.log('[PgsCanvasEngine] First 100 bytes of stream:', str);
        }

        try {
          this.demuxer.push(value);
          const frames = this.demuxer.demux();
          let addedFrames = 0;
          for (const frame of frames) {
              const frameData = frame.data;
              // Subtitle timestamps are absolute, but video.currentTime might start from 0 if DASH
              // We must offset the subtitle PTS so it perfectly matches video.currentTime
              const adjustedTsMs = frame.ts - this.timeOffsetMs;
              const pts = adjustedTsMs * 90; // Convert ms to 90kHz ticks
              
              // FrameData contains one or more PGS segments: [Type (1)][Size (2)][Payload (Size)]
              // We must prefix EACH segment with the 10-byte PES header (0x50 0x47 + PTS + DTS)
              let i = 0;
              while (i < frameData.length) {
                if (i + 3 > frameData.length) break;
                const type = frameData[i];
                const size = (frameData[i+1] << 8) | frameData[i+2];
                if (i + 3 + size > frameData.length) break;
                
                const header = new Uint8Array(10);
                header[0] = 0x50; // 'P'
                header[1] = 0x47; // 'G'
                header[2] = (pts >>> 24) & 0xFF;
                header[3] = (pts >>> 16) & 0xFF;
                header[4] = (pts >>> 8) & 0xFF;
                header[5] = pts & 0xFF;
                header[6] = header[2]; // DTS = PTS
                header[7] = header[3];
                header[8] = header[4];
                header[9] = header[5];
                
                this.chunks.push(header);
                this.chunks.push(frameData.subarray(i, i + 3 + size));
                
                this.totalBytes += 10 + 3 + size;
                i += 3 + size;
              }
              
              addedFrames++;
              console.log(`[PgsCanvasEngine] Pushed synthesized PGS frame of size ${frameData.byteLength} bytes at ${frame.ts}ms`);
          }
          
          // Feed the renderer incrementally as new frames arrive
          if (addedFrames > 0 && this.totalBytes > this.lastRenderedBytes) {
             this._feedRenderer();
          }
        } catch (demuxErr) {
          console.error('[PgsCanvasEngine] Fatal Demuxing error:', demuxErr);
          throw demuxErr;
        }
      }
      
      console.log('[PgsCanvasEngine] Stream processing loop ended.');

    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('[PgsCanvasEngine] Stream aborted via dispose.');
      } else {
        console.error('[PgsCanvasEngine] Stream error:', e);
      }
    }
  }

  async _feedRenderer() {
    if (!this.chunks.length) return;
    
    const mergedArray = new Uint8Array(this.totalBytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      mergedArray.set(chunk, offset);
      offset += chunk.byteLength;
    }

    if (!this.pgsRenderer) {
      console.log('[PgsCanvasEngine] Initializing libpgs PgsRenderer...');
      this.pgsRenderer = new PgsRenderer({
        workerUrl: workerUrl,
        video: this.videoElement,
        canvas: this.canvasElement,
        mode: 'mainThread' // PgsRendererMode.mainThread (avoids Worker buffer cloning OOM)
      });
    }

    // Feed the accumulated `.sup` buffer to the renderer worker
    this.pgsRenderer.loadFromBuffer(mergedArray.buffer);
    this.lastRenderedBytes = this.totalBytes;
    console.log(`[PgsCanvasEngine] PgsRenderer buffer updated with ${this.totalBytes} bytes.`);    
  }

  handleSeek() {
      console.log(`[PgsCanvasEngine] Seek detected! Leaving subtitle stream running in background.`);
  }

  dispose() {
    this.isDisposed = true;
    if (this.debugInterval) {
        this.debugInterval = null;
    }
    const overlay = document.getElementById('pgs-debug-overlay');
    if (overlay) overlay.remove();
    if (this.abortController) {
        this.abortController.abort();
    }
    if (this.videoElement) {
        this.videoElement.removeEventListener('seeked', this.handleSeek);
    }
    
    if (this.pgsRenderer) {
      this.pgsRenderer.dispose();
      this.pgsRenderer = null;
    }
    
    this.chunks = [];
    this.demuxer = null;
    console.log('[PgsCanvasEngine] Engine disposed and memory cleared.');
  }
}
