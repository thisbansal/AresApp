const TABLE_NAME = 'persistentData';

/**
 * Initialize DB8 table (call once on app start)
 */
export function initDB8() {
  return new Promise((resolve, reject) => {
    window.webOS.service.request('luna://com.webos.db/put', {
      parameters: {
        query: [
          {
            op: 'create',
            table: TABLE_NAME,
            schema: {
              key: { type: 'string', primary: true },
              value: { type: 'string' }
            }
          }
        ]
      },
      onSuccess: resolve,
      onFailure: (err) => {
        // Table may already exist; treat as success
        if (err.errorCode === 8) resolve();
        else reject(err);
      }
    });
  });
}

/**
 * Store or update a key-value pair
 */
export function setItem(key, value) {
  return new Promise((resolve, reject) => {
    window.webOS.service.request('luna://com.webos.db/put', {
      parameters: {
        query: [
          {
            op: 'upsert', // insert or update if exists
            table: TABLE_NAME,
            values: { key, value }
          }
        ]
      },
      onSuccess: resolve,
      onFailure: reject
    });
  });
}

/**
 * Retrieve a value by key
 */
export function getItem(key) {
  return new Promise((resolve, reject) => {
    window.webOS.service.request('luna://com.webos.db/find', {
      parameters: {
        query: {
          from: TABLE_NAME,
          where: { key }
        }
      },
      onSuccess: (res) => {
        if (res.results && res.results.length > 0) resolve(res.results[0].value);
        else resolve(null);
      },
      onFailure: reject
    });
  });
}

/**
 * Delete a key-value pair
 */
export function removeItem(key) {
  return new Promise((resolve, reject) => {
    window.webOS.service.request('luna://com.webos.db/remove', {
      parameters: {
        query: {
          from: TABLE_NAME,
          where: { key }
        }
      },
      onSuccess: resolve,
      onFailure: reject
    });
  });
}

/**
 * Retrieve all items
 */
export function getAllItems() {
  return new Promise((resolve, reject) => {
    window.webOS.service.request('luna://com.webos.db/find', {
      parameters: { query: { from: TABLE_NAME } },
      onSuccess: (res) => resolve(res.results || []),
      onFailure: reject
    });
  });
}