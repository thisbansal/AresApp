// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest'
import MediaCodecService from '../src/services/MediaCodecService'

describe('MediaCodecService', () => {
  let mediaCodecService
  let mockCanPlayType

  beforeEach(() => {
    mockCanPlayType = vi.fn()
    const mockVideoEl = document.createElement('video')
    mockVideoEl.canPlayType = mockCanPlayType

    mediaCodecService = new MediaCodecService()
    mediaCodecService.videoElement = mockVideoEl
  })

  it('correctly maps AAC audio to supported if browser supports it', () => {
    mockCanPlayType.mockReturnValue('probably')

    const streamData = {
      audio: [{ id: '1', codec: 'aac', displayTitle: 'AAC Stereo' }]
    }

    const capabilities = mediaCodecService.checkStreamCapabilities(streamData)

    expect(capabilities.audio).toHaveLength(1)
    expect(capabilities.audio[0].supported).toBe(true)
    expect(mockCanPlayType).toHaveBeenCalledWith('audio/mp4; codecs="mp4a.40.2"')
  })

  it('correctly maps unsupported codecs (e.g. TrueHD) to false', () => {
    mockCanPlayType.mockReturnValue('') // Browser says nope

    const streamData = {
      audio: [{ id: '2', codec: 'truehd', displayTitle: 'TrueHD 7.1' }]
    }

    const capabilities = mediaCodecService.checkStreamCapabilities(streamData)

    expect(capabilities.audio).toHaveLength(1)
    expect(capabilities.audio[0].supported).toBe(false)
  })

  it('marks direct play as unsupported if any selected stream is unsupported', () => {
    mockCanPlayType.mockImplementation(mimeType => {
      if (mimeType.includes('avc1')) return 'probably'
      return ''
    })

    const streamData = {
      video: [{ id: '1', codec: 'h264' }],
      audio: [{ id: '2', codec: 'dca' }] // DTS is typically unsupported natively in browsers
    }

    const capabilities = mediaCodecService.checkStreamCapabilities(streamData)

    expect(capabilities.video[0].supported).toBe(true)
    expect(capabilities.audio[0].supported).toBe(false)
  })
})
