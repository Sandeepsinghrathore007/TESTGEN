/**
 * src/storage/migration.js — Migrates localStorage data to IndexedDB
 */

import { STORES, setAll, get } from './db'

const SESSIONS_LS_KEY = 'learnledger.chatSessions.v2'
const TESTS_LS_KEY = 'learnledger.savedTests.v1'
const MIGRATION_FLAG = 'learnledger.idb_migration_complete'

export async function migrateStorageToIDB() {
  if (typeof window === 'undefined' || !window.localStorage) return

  const isMigrated = window.localStorage.getItem(MIGRATION_FLAG)
  if (isMigrated === 'true') return // Already migrated

  console.log('Starting LearnLedger IndexedDB migration...')

  try {
    // 1. Read legacy data
    let lsSessions = []
    let lsTests = []

    try {
      const sRaw = window.localStorage.getItem(SESSIONS_LS_KEY)
      if (sRaw) lsSessions = JSON.parse(sRaw)
    } catch (e) {
      console.warn('Failed to parse LS sessions', e)
    }

    try {
      const tRaw = window.localStorage.getItem(TESTS_LS_KEY)
      if (tRaw) lsTests = JSON.parse(tRaw)
    } catch (e) {
      console.warn('Failed to parse LS tests', e)
    }

    if (!Array.isArray(lsSessions)) lsSessions = []
    if (!Array.isArray(lsTests)) lsTests = []

    // 2. Extract and deduplicate all tests
    const testsMap = new Map()
    lsTests.forEach(t => {
      if (t && t.id) testsMap.set(t.id, t)
    })
    
    // Process sessions and replace nested test with testId
    const migratedSessions = lsSessions.map(session => {
      const migratedSession = { ...session }
      if (session.test && session.test.id) {
        testsMap.set(session.test.id, session.test)
        migratedSession.testId = session.test.id
        delete migratedSession.test
      } else if (session.testId) {
        // Already normalized
      }
      return migratedSession
    })

    const allTests = Array.from(testsMap.values())

    // 3. Save to IndexedDB
    if (allTests.length > 0) {
      await setAll(STORES.TESTS, allTests)
    }
    if (migratedSessions.length > 0) {
      await setAll(STORES.SESSIONS, migratedSessions)
    }

    // 4. Mark complete and clean up localStorage (optional, but requested by user)
    window.localStorage.setItem(MIGRATION_FLAG, 'true')
    window.localStorage.removeItem(SESSIONS_LS_KEY)
    window.localStorage.removeItem(TESTS_LS_KEY)

    console.log(`Migration complete. Migrated ${migratedSessions.length} sessions and ${allTests.length} tests to IndexedDB.`)
  } catch (error) {
    console.error('Migration to IndexedDB failed:', error)
  }
}
