/**
 * Environment Detection
 * Detects if running on webOS TV or desktop browser
 */

export const isWebOS = () => {
  // Check for webOS-specific APIs
  return typeof window !== 'undefined' && (
    webos !== undefined ||
    window.PalmSystem !== undefined ||
    navigator.userAgent.includes('Web0S') ||
    navigator.userAgent.includes('webOS')
  )
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
  console.log(`[Environment] Running on: ${env}`)

  if (env === 'webos') {
    console.log('[Environment] webOS TV detected - using webOS storage APIs')
  } else {
    console.log('[Environment] Browser detected - using IndexedDB')
  }

  return env
}