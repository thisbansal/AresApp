export const saveToken = async (token) => {
  if (!webos?.service) {
    console.warn('webOS not available, using localStorage')
    localStorage.setItem('plexToken', token)
    return
  }

  return new Promise((resolve, reject) => {
    window?.webos?.service.request('luna://com.window?.webos?.service.configurator', {
      method: 'setConfigs',
      parameters: {
        configs: {
          'plexAuthToken': token
        }
      },
      onSuccess: resolve,
      onFailure: reject
    })
  })
}

export const getToken = async () => {
  if (!webos?.service) {
    console.warn('webOS not available, using localStorage')
    console.log(`plexToken: ${localStorage.getItem('plexToken')}`)
    return localStorage.getItem('plexToken')
  }

  return new Promise((resolve, reject) => {
    window?.webos?.service.request('luna://com.window?.webos?.service.configurator', {
      method: 'getConfigs',
      parameters: {
        configNames: ['plexAuthToken']
      },
      onSuccess: (res) => {
        console.log(resolve(res?.configs?.plexAuthToken))
        resolve(res?.configs?.plexAuthToken)
      },
      onFailure: reject
    })
  })
}

export const clearToken = async () => {
  if (!webos?.service) {
    localStorage.removeItem('plexToken')
    return
  }

  return new Promise((resolve, reject) => {
    window?.webos?.service.request('luna://com.window?.webos?.service.configurator', {
      method: 'setConfigs',
      parameters: {
        configs: {
          'plexAuthToken': null
        }
      },
      onSuccess: resolve,
      onFailure: reject
    })
  })
}