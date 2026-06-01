import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { VttStreamSubtitleHandler } from './VttStreamSubtitleHandler';

describe('VttStreamSubtitleHandler', () => {
  let getTimeCallback;
  let setTextCallback;
  let onCachingStateChange;
  let handler;

  beforeEach(() => {
    getTimeCallback = vi.fn(() => 10);
    setTextCallback = vi.fn();
    onCachingStateChange = vi.fn();
    
    // Mock global fetch for the start method
    global.fetch = vi.fn(() =>
      Promise.resolve({
        ok: true,
        body: {
          getReader: () => ({
            read: vi.fn().mockResolvedValue({ done: true, value: undefined })
          })
        }
      })
    );

    // Mock requestAnimationFrame and cancelAnimationFrame
    global.requestAnimationFrame = vi.fn(cb => setTimeout(cb, 16));
    global.cancelAnimationFrame = vi.fn(clearTimeout);

    handler = new VttStreamSubtitleHandler(getTimeCallback, setTextCallback, onCachingStateChange);
  });

  afterEach(() => {
    vi.clearAllMocks();
    handler.destroy();
  });

  it('safely calls destroy() before start() without crashing', () => {
    // Crucial bugfix test: If abortController is undefined, destroy() should not throw
    expect(() => {
      handler.destroy();
    }).not.toThrow();

    expect(setTextCallback).toHaveBeenCalledWith('');
  });

  it('safely calls destroy() after start() and aborts the controller', async () => {
    // Start the handler to initialize the abort controller
    const startPromise = handler.start('http://test-url.com/sub.vtt');
    
    // The abort controller is now defined
    expect(handler.abortController).toBeDefined();
    
    const abortSpy = vi.spyOn(handler.abortController, 'abort');
    
    // Destroy it mid-flight
    handler.destroy();
    
    expect(abortSpy).toHaveBeenCalled();
    expect(setTextCallback).toHaveBeenCalledWith('');
  });
});
