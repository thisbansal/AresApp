let cachedInfo = null;

export async function getPlatformInfo() {
  if (cachedInfo) return cachedInfo;

  return new Promise((resolve) => {
    const fallbackInfo = {
      platform: 'Chrome', // Default to Chrome for Plex profile compatibility if unknown
      device: 'Browser',
      version: '1.0' // Use a numeric fallback to prevent XML version constraint crashes
    };

    const ua = navigator.userAgent || '';

    // If running in a true webOS environment
    if (window.webOS && window.webOS.deviceInfo) {
      window.webOS.deviceInfo(function (device) {
        cachedInfo = {
          platform: 'webOS',
          device: device.modelName || 'webOS TV',
          version: device.sdkVersion || device.version || fallbackInfo.version
        };
        resolve(cachedInfo);
      });
    } else {
      // Basic fallback for development/browser testing
      if (ua.includes('Mac OS')) {
        cachedInfo = { ...fallbackInfo, device: 'Mac' };
      } else if (ua.includes('Windows')) {
        cachedInfo = { ...fallbackInfo, device: 'Windows' };
      } else {
        cachedInfo = fallbackInfo;
      }
      resolve(cachedInfo);
    }
  });
}
