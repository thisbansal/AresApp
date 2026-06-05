import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { plexStreamBuilder } from '../plexStreamBuilder';
import { PLEX_CONFIG } from '../../../config/app';

// Mock getPlatformInfo
vi.mock('../../../utils/platformInfo', () => ({
  getPlatformInfo: vi.fn().mockResolvedValue({
    platform: 'WebOS',
    device: 'LG TV',
    version: '5.0',
  })
}));

describe('PlexStreamBuilder', () => {
  const mockServerInfo = {
    uri: 'http://192.168.1.100:32400',
    token: 'mock-token',
    clientIdentifier: 'mock-client'
  };

  const mockPartKey = '/library/parts/1234/1111/file.mkv';
  const mockRatingKey = '/library/metadata/1234';
  const mockPlaybackSessionId = 'sess-123';
  const mockClientSessionId = 'client-123';

  let originalMediaSource;

  beforeEach(() => {
    // Save original MediaSource if any
    originalMediaSource = global.MediaSource;
  });

  afterEach(() => {
    // Restore original MediaSource
    global.MediaSource = originalMediaSource;
    vi.restoreAllMocks();
  });

  it('buildDirectPlayUrl should return a correct direct play URL', () => {
    const url = plexStreamBuilder.buildDirectPlayUrl(mockServerInfo, mockPartKey);
    expect(url).toBe('http://192.168.1.100:32400/library/parts/1234/1111/file.mkv?X-Plex-Token=mock-token');
  });

  describe('buildTranscodeUrl - HEVC MSE Support', () => {
    it('should NOT append hevc videoProfile if MSE HEVC is NOT supported', async () => {
      // Mock MediaSource WITHOUT HEVC support
      global.MediaSource = {
        isTypeSupported: vi.fn((type) => {
          if (type.includes('hev1') || type.includes('hvc1')) return false;
          if (type.includes('ac-3') || type.includes('ec-3')) return true;
          return false;
        })
      };

      const capabilities = {
        video: [{ selected: true, supported: true, codec: 'hevc' }],
        audio: [{ selected: true, supported: true, codec: 'aac' }],
        subtitles: []
      };

      // Mock fetch for the decision ping
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok')
      });

      const url = await plexStreamBuilder.buildTranscodeUrl(
        mockServerInfo, mockRatingKey, mockPartKey, mockPlaybackSessionId, mockClientSessionId, 0, false, capabilities
      );

      // Verify that videoCodec=hevc is NOT in the URL
      expect(url).not.toContain('videoCodec=hevc');
    });

    it('should append hevc videoProfile if MSE HEVC IS supported', async () => {
      // Mock MediaSource WITH HEVC support
      global.MediaSource = {
        isTypeSupported: vi.fn((type) => {
          if (type.includes('hev1') || type.includes('hvc1')) return true;
          if (type.includes('ac-3') || type.includes('ec-3')) return true;
          return false;
        })
      };

      const capabilities = {
        video: [{ selected: true, supported: true, codec: 'hevc' }],
        audio: [{ selected: true, supported: true, codec: 'aac' }],
        subtitles: []
      };

      // Mock fetch for the decision ping
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: () => Promise.resolve('ok')
      });

      const url = await plexStreamBuilder.buildTranscodeUrl(
        mockServerInfo, mockRatingKey, mockPartKey, mockPlaybackSessionId, mockClientSessionId, 0, false, capabilities
      );

      // Verify that videoCodec=hevc IS in the URL
      expect(url).toContain('videoCodec%3Dhevc');
    });
  });
});
