/**
 * Browser-only persistence for generated and completed tests.
 * Migrated to IndexedDB.
 */
import { STORES, get, getAll, set, setAll, remove } from '@/storage/db'

export async function readSavedTestsAsync() {
  try {
    const tests = await getAll(STORES.TESTS)
    return tests.sort((a, b) => new Date(b.savedAt || b.createdAt) - new Date(a.savedAt || a.createdAt))
  } catch (error) {
    console.warn('Unable to read saved tests from IndexedDB:', error)
    return []
  }
}

export async function writeSavedTestsAsync(tests) {
  try {
    await setAll(STORES.TESTS, tests)
  } catch (error) {
    console.warn('Unable to write saved tests to IndexedDB:', error)
  }
}

export async function saveTestAsync(test) {
  if (!test?.id) return test

  const nextTest = {
    ...test,
    savedAt: test.savedAt || new Date().toISOString(),
    persistMode: 'local',
  }
  
  try {
    await set(STORES.TESTS, nextTest)
  } catch (error) {
    console.warn('Unable to save test to IndexedDB:', error)
  }
  return nextTest
}

export async function removeSavedTestAsync(testId) {
  try {
    await remove(STORES.TESTS, testId)
  } catch (error) {
    console.warn('Unable to remove saved test from IndexedDB:', error)
  }
}
