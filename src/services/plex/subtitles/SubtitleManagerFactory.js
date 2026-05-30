import { VttStreamSubtitleHandler } from './VttStreamSubtitleHandler'

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
   * @param {Function} getTimeCallback - Resolves the absolute movie time
   * @param {Object} subtitleOverlayRef - A React ref exposing setText(text) and clearText()
   * @returns {Object|null} A handler with start(url) and destroy() methods, or null if unhandled
   */
  static createHandler(activeSubtitle, getTimeCallback, subtitleOverlayRef) {
    if (!activeSubtitle) return null;

    const codec = activeSubtitle.codec?.toLowerCase()

    // Image-based codecs and highly stylized text codecs (ASS/SSA) MUST be burned in by the Plex Universal Transcoder.
    // They cannot be extracted as sidecar VTT streams without catastrophic loss of formatting (or outright 400 Bad Requests).
    const unsupportedSidecarCodecs = ['pgs', 'vobsub', 'dvb_subtitle', 'dvd_subtitle', 'ass', 'ssa']
    if (unsupportedSidecarCodecs.includes(codec)) {
      console.log(`[SubtitleFactory] Selected subtitle is image-based (${codec}). Returning null (Burn-in required).`)
      return null
    }

    // 2. Text-based codecs (SRT, VTT, ASS, etc.)
    // We utilize the custom VttStreamSubtitleHandler which fetches the extracted VTT sidecar 
    // and syncs it precisely to the video using the provided DOM overlay ref.
    console.log(`[SubtitleFactory] Selected text-based subtitle (${codec}). Instantiating VttStreamSubtitleHandler.`)
    return new VttStreamSubtitleHandler(getTimeCallback, subtitleOverlayRef)

    // Future Extensibility:
    // If we wanted to support native HTML5 <track> elements for simple SRT files, we could add:
    // return new NativeTrackSubtitleHandler(...)
  }
}
