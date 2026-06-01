import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NativeTextTrackSubtitleHandler } from './NativeTextTrackSubtitleHandler';

describe('NativeTextTrackSubtitleHandler', () => {
  let shakaRef;
  let videoRef;
  let setTextCallback;
  let handler;

  beforeEach(() => {
    vi.useFakeTimers();

    shakaRef = {
      current: {
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }
    };

    videoRef = {
      current: {
        textTracks: []
      }
    };

    setTextCallback = vi.fn();

    handler = new NativeTextTrackSubtitleHandler(shakaRef, videoRef, setTextCallback);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('binds to trackschanged and texttrackvisibility events on start()', () => {
    handler.start();

    expect(shakaRef.current.addEventListener).toHaveBeenCalledWith('trackschanged', handler.bindShakaTracks);
  });

  it('safely defers track.mode mutation to prevent WebOS MSE pipeline crashes', () => {
    const mockTrack = {
      mode: 'showing',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    videoRef.current.textTracks = [mockTrack];

    handler.bindShakaTracks();

    // Mode should NOT be changed synchronously! (WebOS crash prevention)
    expect(mockTrack.mode).toBe('showing');
    
    // Fast-forward 1 second
    vi.advanceTimersByTime(1000);

    // Now it should be hidden
    expect(mockTrack.mode).toBe('hidden');
    expect(mockTrack.addEventListener).toHaveBeenCalledWith('cuechange', handler.handleCueChange);
  });

  it('cleans up old tracks before binding new ones', () => {
    const oldTrack = {
      mode: 'showing',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    
    videoRef.current.textTracks = [oldTrack];
    handler.bindShakaTracks();
    
    // Simulate Shaka switching to a new track
    const newTrack = {
      mode: 'showing',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    videoRef.current.textTracks = [newTrack];
    handler.bindShakaTracks();

    expect(oldTrack.removeEventListener).toHaveBeenCalledWith('cuechange', handler.handleCueChange);
    expect(newTrack.addEventListener).toHaveBeenCalledWith('cuechange', handler.handleCueChange);
  });

  it('strips HTML and calls setTextCallback on cuechange', () => {
    const mockTrack = {
      mode: 'showing',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      activeCues: [
        { text: '<b>Hello</b>' },
        { text: '<i>World!</i>' }
      ]
    };
    
    videoRef.current.textTracks = [mockTrack];
    handler.bindShakaTracks();
    
    // Simulate cuechange
    handler.handleCueChange();

    // Verify HTML is stripped properly
    expect(setTextCallback).toHaveBeenCalledWith('Hello\nWorld!');
  });

  it('clears text callback when no cues are active', () => {
    const mockTrack = {
      mode: 'showing',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      activeCues: []
    };
    
    videoRef.current.textTracks = [mockTrack];
    handler.bindShakaTracks();
    handler.handleCueChange();

    expect(setTextCallback).toHaveBeenCalledWith('');
  });

  it('cleans up everything on destroy()', () => {
    const mockTrack = {
      mode: 'showing',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    };
    videoRef.current.textTracks = [mockTrack];
    handler.bindShakaTracks();

    handler.destroy();

    expect(shakaRef.current.removeEventListener).toHaveBeenCalledWith('trackschanged', handler.bindShakaTracks);
    expect(mockTrack.removeEventListener).toHaveBeenCalledWith('cuechange', handler.handleCueChange);
    expect(setTextCallback).toHaveBeenCalledWith('');
  });
});
