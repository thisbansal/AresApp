import { describe, it, expect, vi, beforeEach } from 'vitest';
import { plexStreamBuilder } from '../src/services/plex/plexStreamBuilder';

// Mock getPlatformInfo so it resolves synchronously or with known data
vi.mock('../src/utils/platformInfo', () => ({
  getPlatformInfo: vi.fn(() => Promise.resolve({
    platform: 'WebOS',
    device: 'LG TV',
    version: '6.0'
  }))
}));

// Mock app config
vi.mock('../src/config/app', () => ({
  PLEX_CONFIG: {
    clientId: 'test-client',
    product: 'test-product',
    features: {
      enableSmartTranscoding: true
    }
  }
}));

describe('PlexStreamBuilder', () => {
  const serverInfo = { uri: 'http://test', token: 'token123', clientIdentifier: 'client-1' };

  beforeEach(() => {
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        text: () => Promise.resolve('mock_m3u8_content')
      })
    );
  });
  
  describe('buildTranscodeUrl', () => {
    it('sets advancedSubtitles=text and subtitles=none by default to prevent unwarranted burn-in', async () => {
      const url = await plexStreamBuilder.buildTranscodeUrl(
        serverInfo,
        '/library/metadata/123',
        '/library/parts/123/1234/file.mkv',
        'session-123',
        'client-123',
        0,
        false // forceSubtitleBurnIn
      );

      expect(url).toContain('subtitles=none');
      expect(url).toContain('advancedSubtitles=text');
    });

    it('sets subtitles=auto when a text-based subtitle is selected and capabilities are provided', async () => {
      const url = await plexStreamBuilder.buildTranscodeUrl(
        serverInfo,
        '/library/metadata/123',
        '/library/parts/123/1234/file.mkv',
        'session-123',
        'client-123',
        0,
        false, // forceSubtitleBurnIn
        { video: [], subtitles: [{ id: 1234, selected: true }] }
      );

      expect(url).toContain('subtitles=auto');
      expect(url).toContain('advancedSubtitles=text');
    });

    it('sets advancedSubtitles=burn and subtitles=burn when burn-in is forced', async () => {
      const url = await plexStreamBuilder.buildTranscodeUrl(
        serverInfo,
        '/library/metadata/123',
        '/library/parts/123/1234/file.mkv',
        'session-123',
        'client-123',
        0,
        true // forceSubtitleBurnIn
      );

      expect(url).toContain('subtitles=burn');
      expect(url).toContain('advancedSubtitles=burn');
    });
  });
});
