/**
 * src/storage/db.js — IndexedDB abstraction for LearnLedger
 */

const DB_NAME = 'LearnLedgerDB'
// Version 3 adds the attachments store for people who already have a v2 DB.
const DB_VERSION = 3

const STORES = {
  SESSIONS: 'sessions',
  TESTS: 'tests',
  SETTINGS: 'settings',
  ATTACHMENTS: 'attachments',
}

let dbPromise = null

function getDB() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') {
        reject(new Error('IndexedDB is not available in this browser.'))
        return
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = event.target.result
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.TESTS)) {
          db.createObjectStore(STORES.TESTS, { keyPath: 'id' })
        }
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' })
        }
        if (!db.objectStoreNames.contains(STORES.ATTACHMENTS)) {
          const attachments = db.createObjectStore(STORES.ATTACHMENTS, { keyPath: 'id' })
          attachments.createIndex('sessionId', 'sessionId', { unique: false })
          attachments.createIndex('fingerprint', 'fingerprint', { unique: false })
        }
      }

      request.onsuccess = (event) => {
        const db = event.target.result

        // Release stale connections when another tab needs to upgrade the DB.
        // Without this, a PWA tab can keep the next app load on "Loading sessions...".
        db.onversionchange = () => {
          db.close()
          dbPromise = null
        }

        resolve(db)
      }
      request.onblocked = () => reject(new Error('Saved data is open in another LearnLedger tab. Close it and reload this page.'))
      request.onerror = (event) => reject(event.target.error || new Error('Could not open saved data.'))
    })

    // Do not cache a failed/blocked open request forever; a retry must be able
    // to create a fresh request after the other tab is closed.
    dbPromise.catch(() => {
      dbPromise = null
    })
  }
  return dbPromise
}

export async function get(storeName, key) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.get(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function set(storeName, item) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.put(item)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function remove(storeName, key) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    const request = store.delete(key)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

export async function getAll(storeName) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.getAll()
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function getAllByIndex(storeName, indexName, key) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const request = store.index(indexName).getAll(key)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function setAll(storeName, items) {
  const db = await getDB()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, 'readwrite')
    const store = tx.objectStore(storeName)
    
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)

    items.forEach(item => store.put(item))
  })
}

export async function setMultiStore(items) {
  const db = await getDB()
  const storeNames = [...new Set(items.map(i => i.store))]
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeNames, 'readwrite')
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    items.forEach(({ store, data }) => tx.objectStore(store).put(data))
  })
}

export { STORES }
