/**
 * Environment Detection
 * Detects if running on webOS TV or desktop browser
 */

export const isWebOS = () => {
  return typeof window !== 'undefined' && (!!window.webOS || !!window.webos || typeof PalmSystem !== 'undefined')
}

export const isBrowser = () => {
  return !isWebOS()
}

export const getEnvironment = () => {
  if (isWebOS()) {
    return 'webos'
  }
  return 'browser'
}

export const logEnvironment = () => {
  const env = getEnvironment()
  if (env === 'webos') {
    console.log('[Environment] webOS TV detected - using webOS storage APIs')
  } else {
    console.log('[Environment] Browser detected - using IndexedDB')
  }

  return env
}