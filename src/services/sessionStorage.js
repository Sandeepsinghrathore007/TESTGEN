/**
 * sessionStorage.js — Local persistence for AI chat and test sessions.
 * Chat records are stored in IndexedDB alongside saved tests. Uploaded file
 * blobs use IndexedDB separately.
 */

import { uid } from '@/utils/id'
import { deleteAttachmentsForSession } from '@/services/attachmentStorage'
import { STORES, getAll, set, setAll, remove } from '@/storage/db'
import { saveTestAsync } from '@/services/localTestStorage'

const SESSIONS_STORAGE_KEY = 'learnledger.chatSessions.v2'
const SESSIONS_UPDATED_EVENT = 'learnledger:sessions-updated'

// Keep same-action creation requests together until the local write settles so a
// rapid double click cannot create two sessions.
const pendingSessionCreations = new Map()

function notifySessionsChanged() {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent(SESSIONS_UPDATED_EVENT))
}

function readLegacySessions() {
  if (typeof window === 'undefined' || !window.localStorage) return []

  try {
    const rawSessions = window.localStorage.getItem(SESSIONS_STORAGE_KEY)
    const sessions = rawSessions ? JSON.parse(rawSessions) : []
    return Array.isArray(sessions) ? sessions : []
  } catch (error) {
    console.error('Failed to read saved sessions:', error)
    return []
  }
}

function normalizeSessionForStorage(session) {
  if (!session?.id) return null

  const nextSession = { ...session }
  if (nextSession.test?.id) {
    nextSession.testId = nextSession.test.id
    delete nextSession.test
  }
  return nextSession
}

async function hydrateSessionTests(sessions) {
  const tests = await getAll(STORES.TESTS)
  const testsById = new Map(tests.filter((test) => test?.id).map((test) => [test.id, test]))

  return sessions.map((session) => {
    if (session?.test?.id) return session
    const test = session?.testId ? testsById.get(session.testId) : null
    return test ? { ...session, test } : session
  })
}

async function readStoredSessions() {
  let sessions = await getAll(STORES.SESSIONS)

  if (!Array.isArray(sessions) || sessions.length === 0) {
    const legacySessions = readLegacySessions()
    if (legacySessions.length > 0) {
      await storeSessions(legacySessions)
      sessions = await getAll(STORES.SESSIONS)
      try {
        window.localStorage.removeItem(SESSIONS_STORAGE_KEY)
      } catch {
        // Keeping the migrated copy is harmless if localStorage cannot be changed.
      }
    }
  }

  return hydrateSessionTests(Array.isArray(sessions) ? sessions : [])
}

async function storeSessions(sessions) {
  const incomingSessions = Array.isArray(sessions) ? sessions.filter((session) => session?.id) : []

  await Promise.all(incomingSessions.map((session) => (
    session?.test?.id ? saveTestAsync(session.test) : Promise.resolve()
  )))

  const normalizedSessions = incomingSessions
    .map(normalizeSessionForStorage)
    .filter(Boolean)
  const incomingIds = new Set(normalizedSessions.map((session) => session.id))
  const existingSessions = await getAll(STORES.SESSIONS)
  const staleSessions = existingSessions.filter((session) => session?.id && !incomingIds.has(session.id))

  await Promise.all(staleSessions.map((session) => remove(STORES.SESSIONS, session.id)))
  await setAll(STORES.SESSIONS, normalizedSessions)
  notifySessionsChanged()
}

function sortSessions(sessions) {
  return [...sessions].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
}

/**
 * Read all sessions and populate their embedded tests
 */
export async function readSessionsAsync() {
  return sortSessions(await readStoredSessions())
}

/**
 * Write multiple sessions to browser storage
 */
export async function writeSessionsAsync(sessions) {
  try {
    storeSessions(Array.isArray(sessions) ? sessions : [])
  } catch (err) {
    console.error('Failed to write sessions:', err)
    throw err
  }
}

/**
 * Fetch a single session
 */
export async function getSessionAsync(sessionId) {
  return (await readStoredSessions()).find((session) => session.id === sessionId) || null
}

/**
 * Create a new session
 */
export function createNewSessionAsync(initialTitle = 'New Study Chat', { idempotencyKey } = {}) {
  if (idempotencyKey && pendingSessionCreations.has(idempotencyKey)) {
    return pendingSessionCreations.get(idempotencyKey)
  }

  const creation = (async () => {
    const timestamp = new Date().toISOString()
    const newSession = {
      id: `session_${Date.now()}_${uid()}`,
      title: initialTitle,
      createdAt: timestamp,
      updatedAt: timestamp,
      messages: [
        {
          id: `msg_welcome_${uid()}`,
          role: 'assistant',
          createdAt: timestamp,
          content: 'Ask me to generate questions, revise a concept, or create a test. I will remember our chat and test results.',
        },
      ],
      testId: null,
    }

    const sessions = await readStoredSessions()
    await storeSessions([newSession, ...sessions.filter((session) => session.id !== newSession.id)])
    return newSession
  })()

  if (idempotencyKey) {
    pendingSessionCreations.set(idempotencyKey, creation)
    creation.then(
      () => pendingSessionCreations.delete(idempotencyKey),
      () => pendingSessionCreations.delete(idempotencyKey),
    )
  }

  return creation
}

/**
 * Save a single session
 */
export async function saveSessionAsync(session) {
  if (!session?.id) return session

  const updatedSession = {
    ...session,
    updatedAt: new Date().toISOString(),
  }

  if (updatedSession.test?.id) {
    await saveTestAsync(updatedSession.test)
  }

  const normalizedSession = normalizeSessionForStorage(updatedSession)
  await set(STORES.SESSIONS, normalizedSession)

  const sessions = await readStoredSessions()
  await storeSessions([
    updatedSession,
    ...sessions.filter((storedSession) => storedSession.id !== updatedSession.id),
  ])
  
  // Return the hydrated session as expected by UI
  return { ...updatedSession, test: session.test }
}

/**
 * Delete a single session
 */
export async function deleteSessionAsync(sessionId) {
  try {
    await remove(STORES.SESSIONS, sessionId)
    notifySessionsChanged()

    // Attachment cleanup must not delay deletion of a chat if IndexedDB is unavailable.
    deleteAttachmentsForSession(sessionId).catch((error) => {
      console.warn('Failed to remove session attachments:', error)
    })
  } catch (err) {
    console.error('Failed to delete session:', err)
    throw err
  }
}
