/**
 * MediaDB Service for webOS
 *
 * Stores poster images using webOS MediaDB API
 * Much faster and more efficient than configurator for binary data
 */

const KIND_ID = 'com.plex.posters:1'
const OWNER_ID = 'com.plex.app'

const isWebOS = () => typeof window !== 'undefined' && (!!window.webOS || !!window.webos || typeof PalmSystem !== 'undefined')

/**
 * Initialize MediaDB kind (run once on first use)
 */
export const initMediaDB = async () => {
  if (!isWebOS()) {
    console.log('[MediaDB] Not on webOS, skipping init')
    return true
  }

  return new Promise((resolve) => {
    window?.webos?.service.request('luna://com.webos.service.mediadb', {
      method: 'putKind',
      parameters: {
        id: KIND_ID,
        owner: OWNER_ID,
        schema: {
          id: KIND_ID,
          owner: OWNER_ID,
          indexes: [
            { name: 'itemId', props: [{ name: 'itemId' }] }
          ]
        }
      },
      onSuccess: (res) => {
        console.log('[MediaDB] Kind registered:', res)
        resolve(true)
      },
      onFailure: (err) => {
        // Kind might already exist, that's fine
        console.log('[MediaDB] Kind already exists or init failed:', err)
        resolve(true)
      }
    })
  })
}

/**
 * Store image in MediaDB
 */
export const putImage = async (itemId, base64Data) => {
  if (!isWebOS()) {
    console.warn('[MediaDB] Not on webOS, cannot store')
    return false
  }

  await initMediaDB()

  return new Promise((resolve, reject) => {
    window?.webos?.service.request('luna://com.webos.service.mediadb', {
      method: 'put',
      parameters: {
        objects: [{
          _kind: KIND_ID,
          itemId: itemId.toString(),
          imageData: base64Data,
          timestamp: Date.now()
        }]
      },
      onSuccess: (res) => {
        console.log('[MediaDB] [OK] Stored image:', itemId)
        resolve(true)
      },
      onFailure: (err) => {
        console.error('[MediaDB] [ERROR] Failed to store:', itemId, err)
        reject(err)
      }
    })
  })
}

/**
 * Get image from MediaDB
 */
export const getImage = async (itemId) => {
  if (!isWebOS()) {
    console.warn('[MediaDB] Not on webOS, cannot retrieve')
    return null
  }

  return new Promise((resolve) => {
    window?.webos?.service.request('luna://com.webos.service.mediadb', {
      method: 'find',
      parameters: {
        query: {
          from: KIND_ID,
          where: [
            { prop: 'itemId', op: '=', val: itemId.toString() }
          ]
        }
      },
      onSuccess: (res) => {
        if (res.results && res.results.length > 0) {
          const imageData = res.results[0].imageData
          console.log('[MediaDB] [OK] Retrieved image:', itemId)
          resolve(imageData)
        } else {
          console.log('[MediaDB] [NOT_FOUND] No image found:', itemId)
          resolve(null)
        }
      },
      onFailure: (err) => {
        console.error('[MediaDB] [ERROR] Query failed:', itemId, err)
        resolve(null)
      }
    })
  })
}

/**
 * Delete image from MediaDB
 */
export const deleteImage = async (itemId) => {
  if (!isWebOS()) {
    return true
  }

  return new Promise((resolve) => {
    window?.webos?.service.request('luna://com.webos.service.mediadb', {
      method: 'del',
      parameters: {
        query: {
          from: KIND_ID,
          where: [
            { prop: 'itemId', op: '=', val: itemId.toString() }
          ]
        }
      },
      onSuccess: (res) => {
        console.log('[MediaDB] [OK] Deleted image:', itemId)
        resolve(true)
      },
      onFailure: (err) => {
        console.error('[MediaDB] [ERROR] Delete failed:', itemId, err)
        resolve(false)
      }
    })
  })
}

/**
 * Get all cached image IDs
 */
export const getAllImageIds = async () => {
  if (!isWebOS()) {
    return []
  }

  return new Promise((resolve) => {
    window?.webos?.service.request('luna://com.webos.service.mediadb', {
      method: 'find',
      parameters: {
        query: {
          from: KIND_ID,
          select: ['itemId']
        }
      },
      onSuccess: (res) => {
        const ids = res.results?.map(r => r.itemId) || []
        console.log('[MediaDB] Found', ids.length, 'cached images')
        resolve(ids)
      },
      onFailure: (err) => {
        console.error('[MediaDB] [ERROR] Query failed:', err)
        resolve([])
      }
    })
  })
}

/**
 * Clear all images
 */
export const clearAllImages = async () => {
  if (!isWebOS()) {
    return true
  }

  return new Promise((resolve) => {
    window?.webos?.service.request('luna://com.webos.service.mediadb', {
      method: 'delKind',
      parameters: {
        id: KIND_ID
      },
      onSuccess: (res) => {
        console.log('[MediaDB] [OK] Cleared all images')
        resolve(true)
      },
      onFailure: (err) => {
        console.error('[MediaDB] [ERROR] Clear failed:', err)
        resolve(false)
      }
    })
  })
}