import { VttStreamSubtitleHandler } from './VttStreamSubtitleHandler'
import { NativeTextTrackSubtitleHandler } from './NativeTextTrackSubtitleHandler'

/**
 * SubtitleManagerFactory
 * 
 * Factory Method pattern to encapsulate the instantiation of the correct subtitle handler.
 * It evaluates the selected subtitle stream and returns a handler that conforms to the ISubtitleHandler interface.
 */
export class SubtitleManagerFactory {
  /**
   * Creates a subtitle handler based on the stream type and capabilities.
   * 
   * @param {Object} activeSubtitle - The selected Plex stream object (streamType === 3)
   * @param {boolean} isDash - Whether the active video stream is DASH (uses in-band subtitles)
   * @param {Object} shakaRef - React ref pointing to the Shaka player instance
   * @param {Object} videoRef - React ref pointing to the HTML5 video element
   * @param {Function} getTimeCallback - Resolves the absolute movie time (used by Sidecar)
   * @param {Object} subtitleOverlayRef - A React ref exposing setText(text) and clearText()
   * @param {Function} onCachingStateChange - Callback for cache status updates (used by Sidecar)
   * @returns {Object|null} A handler with start(url) and destroy() methods, or null if unhandled
   */
  static createHandler(activeSubtitle, isDash, shakaRef, videoRef, getTimeCallback, subtitleOverlayRef, onCachingStateChange) {
    if (!activeSubtitle) return null;

    const codec = activeSubtitle.codec?.toLowerCase()

    // Image-based codecs and highly stylized text codecs (ASS/SSA) MUST be burned in by the Plex Universal Transcoder.
    // They cannot be extracted as sidecar VTT streams without catastrophic loss of formatting (or outright 400 Bad Requests).
    const unsupportedSidecarCodecs = ['pgs', 'vobsub', 'dvb_subtitle', 'dvd_subtitle', 'ass', 'ssa']
    if (unsupportedSidecarCodecs.includes(codec)) {
      console.log(`[SubtitleFactory] Selected subtitle is image-based (${codec}). Returning null (Burn-in required).`)
      return null
    }

    const setTextCallback = (text) => {
      if (subtitleOverlayRef && subtitleOverlayRef.current) {
        if (text) {
          subtitleOverlayRef.current.setText(text);
        } else {
          subtitleOverlayRef.current.clearText();
        }
      }
    };

    if (isDash) {
      console.log(`[SubtitleFactory] Selected text-based subtitle (${codec}) on a DASH stream. Instantiating NativeTextTrackSubtitleHandler.`)
      return new NativeTextTrackSubtitleHandler(shakaRef, videoRef, setTextCallback);
    } else {
      console.log(`[SubtitleFactory] Selected text-based subtitle (${codec}) on Direct Play. Instantiating VttStreamSubtitleHandler.`)
      return new VttStreamSubtitleHandler(getTimeCallback, setTextCallback, onCachingStateChange);
    }
  }
}
