import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { SubtitleManagerFactory } from './SubtitleManagerFactory';
import { VttStreamSubtitleHandler } from './VttStreamSubtitleHandler';
import { NativeTextTrackSubtitleHandler } from './NativeTextTrackSubtitleHandler';

describe('SubtitleManagerFactory', () => {
  beforeAll(() => {
    globalThis.requestAnimationFrame = vi.fn();
    globalThis.cancelAnimationFrame = vi.fn();
  });

  afterAll(() => {
    delete globalThis.requestAnimationFrame;
    delete globalThis.cancelAnimationFrame;
  });

  it('returns null if activeSubtitle is missing', () => {
    const handler = SubtitleManagerFactory.createHandler(null, false, null, null, vi.fn(), null, vi.fn());
    expect(handler).toBeNull();
  });

  it('returns null for unsupported image-based codecs (pgs)', () => {
    const activeSubtitle = { streamType: 3, codec: 'pgs' };
    const handler = SubtitleManagerFactory.createHandler(activeSubtitle, false, null, null, vi.fn(), null, vi.fn());
    expect(handler).toBeNull();
  });

  it('returns null for unsupported highly-stylized codecs (ass)', () => {
    const activeSubtitle = { streamType: 3, codec: 'ass' };
    const handler = SubtitleManagerFactory.createHandler(activeSubtitle, false, null, null, vi.fn(), null, vi.fn());
    expect(handler).toBeNull();
  });

  it('instantiates NativeTextTrackSubtitleHandler when isDash is true', () => {
    const activeSubtitle = { streamType: 3, codec: 'srt' };
    const shakaRef = { current: {} };
    const videoRef = { current: {} };
    
    const handler = SubtitleManagerFactory.createHandler(activeSubtitle, true, shakaRef, videoRef, vi.fn(), null, vi.fn());
    
    expect(handler).toBeInstanceOf(NativeTextTrackSubtitleHandler);
    expect(handler.shakaRef).toBe(shakaRef);
    expect(handler.videoRef).toBe(videoRef);
  });

  it('instantiates VttStreamSubtitleHandler when isDash is false', () => {
    const activeSubtitle = { streamType: 3, codec: 'vtt' };
    
    const handler = SubtitleManagerFactory.createHandler(activeSubtitle, false, null, null, vi.fn(), null, vi.fn());
    
    expect(handler).toBeInstanceOf(VttStreamSubtitleHandler);
  });
});
