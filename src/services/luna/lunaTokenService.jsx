export const saveToken = (token) => {
  return new Promise((resolve, reject) => {
    if (!window.webOS?.service) {
      // Fallback for development (browser)
      console.warn('webOS service not available, using localStorage');
      localStorage.setItem('plexToken', token);
      resolve({ returnValue: true });
      return;
    }

    window.webOS.service.request('luna://com.webos.service.systemservice', {
      method: 'setPreferences',
      parameters: {
        category: 'plexAuth',
        settings: { token }
      },
      onSuccess: resolve,
      onFailure: reject
    });
  });
};

export const getToken = () => {
  return new Promise((resolve, reject) => {
    if (!window.webOS?.service) {
      // Fallback for development
      console.warn('webOS service not available, using localStorage');
      const token = localStorage.getItem('plexToken');
      resolve(token);
      return;
    }

    window.webOS.service.request('luna://com.webos.service.systemservice', {
      method: 'getPreferences',
      parameters: {
        category: 'plexAuth',
        keys: ['token']
      },
      onSuccess: (res) => resolve(res?.settings?.token),
      onFailure: reject
    });
  });
};

export const clearToken = () => {
  return new Promise((resolve, reject) => {
    if (!window.webOS?.service) {
      localStorage.removeItem('plexToken');
      resolve({ returnValue: true });
      return;
    }

    window.webOS.service.request('luna://com.webos.service.systemservice', {
      method: 'setPreferences',
      parameters: {
        category: 'plexAuth',
        settings: { token: null }
      },
      onSuccess: resolve,
      onFailure: reject
    });
  });
};