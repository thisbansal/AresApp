import mkvdemuxjs from 'mkvdemuxjs';
import { FastMkvDemuxer } from './fastMkvDemuxer';
import { PgsRenderer } from 'libpgs';
import workerUrl from 'libpgs/dist/libpgs.worker.js?url';

export class PgsCanvasEngine {
  constructor(videoElement, canvasElement) {
    this.videoElement = videoElement;
    this.canvasElement = canvasElement;
    this.pgsRenderer = null;
    this.demuxer = null;
    this.isDisposed = false;
    this.abortController = new AbortController();
    this.chunks = [];
    this.totalBytes = 0;
  }

  async loadStream(url, decisionUrl = null) {
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

      this.demuxer = new FastMkvDemuxer();
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
        if (chunksRead > 20) {
          console.log('[PgsCanvasEngine] Reached 20 chunk hard limit. Stopping fetch to test backpressure.');
          break;
        }

        if (this.isDisposed) break;

        if (!this._firstChunkChecked) {
          this._firstChunkChecked = true;
          const str = new TextDecoder().decode(value.slice(0, 100));
          console.log('[PgsCanvasEngine] First 100 bytes of stream:', str);
        }

        // Feed chunks to mkvdemuxjs (slice to ensure exact buffer length is pushed)
        const exactBuffer = value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength);
        this.demuxer.push(exactBuffer);
        
        try {
          const frames = this.demuxer.demux();
          if (frames && frames.length > 0) {
            console.log(`[PgsCanvasEngine] Extracted ${frames.length} PGS frames from chunk.`);
            for (const frame of frames) {
              this.chunks.push(frame);
              this.totalBytes += frame.byteLength;
            }
          }
        } catch (demuxErr) {
          console.error('[PgsCanvasEngine] Fatal Demuxing error:', demuxErr);
          throw demuxErr;
        }
      }
      
      // Once done, combine all extracted blocks to form a pure .sup buffer
      this._initializeRenderer();

    } catch (e) {
      if (e.name === 'AbortError') {
        console.log('[PgsCanvasEngine] Stream aborted via dispose.');
      } else {
        console.error('[PgsCanvasEngine] Stream error:', e);
      }
    }
  }

  _initializeRenderer() {
    if (this.isDisposed || this.chunks.length === 0) return;

    console.log(`[PgsCanvasEngine] Combining ${this.chunks.length} extracted PGS chunks (${this.totalBytes} bytes)...`);
    const mergedArray = new Uint8Array(this.totalBytes);
    let offset = 0;
    for (const chunk of this.chunks) {
      mergedArray.set(chunk, offset);
      offset += chunk.byteLength;
    }

    console.log('[PgsCanvasEngine] Initializing libpgs PgsRenderer...');
    this.pgsRenderer = new PgsRenderer({
      workerUrl: workerUrl,
      video: this.videoElement,
      canvas: this.canvasElement
    });

    this.pgsRenderer.loadFromBuffer(mergedArray.buffer);
    console.log('[PgsCanvasEngine] PgsRenderer initialized and buffer loaded successfully.');
    
    // Clear chunks to save memory
    this.chunks = [];
  }

  dispose() {
    this.isDisposed = true;
    this.abortController.abort();
    
    if (this.pgsRenderer) {
      this.pgsRenderer.dispose();
      this.pgsRenderer = null;
    }
    
    this.chunks = [];
    this.demuxer = null;
    console.log('[PgsCanvasEngine] Engine disposed and memory cleared.');
  }
}
