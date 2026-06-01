export class NativeTextTrackSubtitleHandler {
  /**
   * @param {Object} shakaRef - React ref pointing to the Shaka player instance
   * @param {Object} videoRef - React ref pointing to the HTML5 video element
   * @param {Function} setTextCallback - Function(text) to render subtitles to the HUD
   */
  constructor(shakaRef, videoRef, setTextCallback) {
    this.shakaRef = shakaRef;
    this.videoRef = videoRef;
    this.setTextCallback = setTextCallback;
    
    this.activeTrack = null;
    this.handleCueChange = this.handleCueChange.bind(this);
    this.bindShakaTracks = this.bindShakaTracks.bind(this);
  }

  /**
   * Binds to the Shaka instance and video element to extract in-band DASH subtitles.
   * PlayerPage.jsx guarantees shakaRef.current is populated before calling this.
   */
  start() {
    const player = this.shakaRef.current;
    if (!player) {
      console.warn('[NativeSubtitleHandler] start() called but Shaka player is missing!');
      return;
    }

    // Bind to Shaka's trackschanged to catch dynamically loaded subtitles
    player.addEventListener('trackschanged', this.bindShakaTracks);
    
    // Also try to bind immediately in case tracks are already loaded
    this.bindShakaTracks();
  }

  bindShakaTracks() {
    const videoEl = this.videoRef.current;
    if (!videoEl || !videoEl.textTracks) return;

    let foundActive = false;
    for (let i = 0; i < videoEl.textTracks.length; i++) {
      const track = videoEl.textTracks[i];
      
      // Shaka sets the active text track mode to 'showing' or 'hidden'
      if (track.mode === 'showing' || track.mode === 'hidden') {
        foundActive = true;
        if (this.activeTrack !== track) {
          // Cleanup old track
          if (this.activeTrack) {
            this.activeTrack.removeEventListener('cuechange', this.handleCueChange);
          }
          
          this.activeTrack = track;
          
          // CRITICAL WEBOS BUGFIX: 
          // Modifying a TextTrack mode synchronously while the video is initializing 
          // causes the Webkit engine to flush the MSE pipeline, interrupting the play() 
          // promise and throwing a fatal Shaka 3015 error. We defer this mutation by 1 second.
          setTimeout(() => {
            if (this.activeTrack === track) {
              this.activeTrack.mode = 'hidden';
            }
          }, 1000);
          
          this.activeTrack.addEventListener('cuechange', this.handleCueChange);
          console.log('[NativeSubtitleHandler] Bound to native text track:', track);
        }
      }
    }

    if (!foundActive && this.activeTrack) {
      // The subtitle track was disabled natively
      this.activeTrack.removeEventListener('cuechange', this.handleCueChange);
      this.activeTrack = null;
      this.setTextCallback('');
    }
  }

  handleCueChange() {
    if (!this.activeTrack) return;
    
    const activeCues = this.activeTrack.activeCues;
    if (activeCues && activeCues.length > 0) {
      // Collect all active cue texts and strip HTML tags
      const text = Array.from(activeCues)
        .map(c => c.text)
        .join('\n')
        .replace(/<[^>]+>/g, ''); // Basic HTML tag stripping
      
      this.setTextCallback(text);
    } else {
      this.setTextCallback('');
    }
  }

  destroy() {
    if (this.shakaRef && this.shakaRef.current) {
      this.shakaRef.current.removeEventListener('trackschanged', this.bindShakaTracks);
    }
    
    if (this.activeTrack) {
      this.activeTrack.removeEventListener('cuechange', this.handleCueChange);
      this.activeTrack = null;
    }
    
    if (this.setTextCallback) {
      this.setTextCallback('');
    }
  }
}
