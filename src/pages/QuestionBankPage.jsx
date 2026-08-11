import { useEffect, useState, useCallback } from 'react'
import { TEXT1, TEXT2, TEXT3, BORDER } from '@/constants/theme'
import { readSessionsAsync, writeSessionsAsync, deleteSessionAsync } from '@/services/sessionStorage'
import { readSavedTestsAsync, saveTestAsync, writeSavedTestsAsync } from '@/services/localTestStorage'
import { formatTestAsTxt, formatAllTestsAsTxt, downloadTxtFile } from '@/utils/exportTest'
import TestTakingView from '@/components/tests/TestTakingView'
import { calculateScore } from '@/utils/testScoring'
import { attachStructuredResultContext, buildResultSummaryMessage } from '@/utils/testResultContext'
import { uid } from '@/utils/id'

const FONT = "'DM Sans', sans-serif"


function attachOriginatingChat(test, chatId) {
  const originChatId = test?.originatingChatId || test?.metadata?.originatingChatId || chatId || null
  if (!test || !originChatId) return test

  return {
    ...test,
    originatingChatId: originChatId,
    metadata: {
      ...(test.metadata || {}),
      originatingChatId: originChatId,
      origin: {
        ...(test.metadata?.origin || {}),
        chatId: originChatId,
      },
    },
  }
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric',
    })
  } catch {
    return ''
  }
}

function levenshteinDistance(a, b) {
  const matrix = []
  for (let i = 0; i <= b.length; i++) matrix[i] = [i]
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1]
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        )
      }
    }
  }
  return matrix[b.length][a.length]
}

function fuzzyMatch(query, target) {
  const qNorm = String(query).toLowerCase().trim().replace(/[^a-z0-9]/g, '')
  const tNorm = String(target).toLowerCase().trim().replace(/[^a-z0-9]/g, '')

  if (!qNorm || !tNorm) return false
  if (tNorm.includes(qNorm) || qNorm.includes(tNorm)) return true

  const distance = levenshteinDistance(qNorm, tNorm)
  const maxLen = Math.max(qNorm.length, tNorm.length)
  const threshold = Math.max(2, Math.floor(maxLen * 0.25))
  return distance <= threshold
}

function getTestScore(test) {
  const questions = Array.isArray(test?.questions) ? test.questions : []
  const answers = test?.answers && typeof test.answers === 'object' ? test.answers : {}

  if (questions.length === 0) return null

  if (typeof test.score === 'number' && typeof test.totalQuestions === 'number') {
    return { correct: test.score, total: test.totalQuestions, percentage: test.percentage || 0 }
  }

  const answeredKeys = Object.keys(answers)
  if (answeredKeys.length === 0) return null

  let correct = 0
  questions.forEach((q) => {
    const userAnswer = answers[q.id]
    if (userAnswer && String(userAnswer).toLowerCase() === String(q.correctAnswer || '').toLowerCase()) {
      correct++
    }
  })

  const total = questions.length
  return { correct, total, percentage: total > 0 ? Math.round((correct / total) * 100) : 0 }
}

function ScoreDisplay({ test }) {
  const isCompleted = test.status === 'completed'
  const answeredCount = test.answers ? Object.keys(test.answers).length : 0
  const totalQuestions = test.questions?.length || 0

  if (!isCompleted && answeredCount > 0) {
    return <span style={{ color: '#f59e0b', fontWeight: 600 }}>In Progress ({answeredCount}/{totalQuestions})</span>
  }

  const score = getTestScore(test)
  if (!score) {
    return <span style={{ color: TEXT3 }}>Not started</span>
  }

  const color = score.percentage >= 70 ? '#22c55e' : score.percentage >= 40 ? '#f59e0b' : '#ef4444'
  return <span style={{ color, fontWeight: 600 }}>{score.correct}/{score.total} ({score.percentage}%)</span>
}

function ReviewOption({ opt, userAnswer, correctAnswer }) {
  const isUserAnswer = userAnswer && String(userAnswer).toLowerCase() === String(opt.id).toLowerCase()
  const isCorrect = String(correctAnswer || '').toLowerCase() === String(opt.id).toLowerCase()

  let bg = 'transparent'
  let borderColor = BORDER
  let textColor = TEXT2
  let badge = null

  if (isCorrect && isUserAnswer) {
    bg = 'rgba(34,197,94,0.10)'
    borderColor = 'rgba(34,197,94,0.35)'
    textColor = '#4ade80'
    badge = 'Correct'
  } else if (isCorrect) {
    bg = 'rgba(34,197,94,0.06)'
    borderColor = 'rgba(34,197,94,0.25)'
    textColor = '#4ade80'
    badge = 'Correct'
  } else if (isUserAnswer) {
    bg = 'rgba(239,68,68,0.10)'
    borderColor = 'rgba(239,68,68,0.30)'
    textColor = '#f87171'
    badge = 'Your answer'
  }

  return (
    <div style={{
      padding: '9px 12px',
      background: bg,
      border: `1px solid ${borderColor}`,
      borderRadius: 8,
      color: textColor,
      fontFamily: FONT,
      fontSize: 13,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    }}>
      <span><strong>{String(opt.id).toUpperCase()}.</strong> {opt.text}</span>
      {badge && <span style={{ fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{badge}</span>}
    </div>
  )
}

function TestReviewPanel({ test, onClose, onExport }) {
  const questions = Array.isArray(test?.questions) ? test.questions : []
  const answers = test?.answers && typeof test.answers === 'object' ? test.answers : {}

  return (
    <div className="animate-fade-in" style={{
      marginTop: 12,
      padding: 20,
      background: 'rgba(0,0,0,0.22)',
      border: `1px solid ${BORDER}`,
      borderRadius: 14,
      display: 'flex',
      flexDirection: 'column',
      gap: 20,
    }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: `1px solid ${BORDER}`,
        paddingBottom: 16,
        gap: 12,
        flexWrap: 'wrap',
      }}>
        <div>
          <h2 style={{ margin: 0, color: TEXT1, fontFamily: FONT, fontSize: 18, fontWeight: 800 }}>
            {test.topic || test.title || 'Review Test'}
          </h2>
          <div style={{ color: TEXT3, fontFamily: FONT, fontSize: 12, marginTop: 4 }}>
            {formatDate(test.completedAt || test.savedAt || test.createdAt)}
            {' · '}
            <ScoreDisplay test={test} />
            {' · '}
            {questions.length} questions
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" onClick={() => onExport(test)} style={{
            padding: '7px 12px',
            background: 'rgba(14,165,233,0.10)',
            border: '1px solid rgba(14,165,233,0.28)',
            borderRadius: 8,
            color: '#38bdf8',
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Export
          </button>
          <button type="button" onClick={onClose} style={{
            padding: '7px 12px',
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            color: TEXT2,
            fontFamily: FONT,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}>
            Close
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
        {questions.map((q, idx) => {
          const options = Array.isArray(q.options) ? q.options : []
          const userAnswer = answers[q.id] || null
          const correctAnswer = q.correctAnswer || ''

          return (
            <div key={q.id || idx} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{
                color: TEXT1,
                fontFamily: FONT,
                fontSize: 14,
                fontWeight: 600,
                lineHeight: 1.6,
              }}>
                Q{idx + 1}. {q.question || q.prompt || 'Question'}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 4 }}>
                {options.map((opt) => (
                  <ReviewOption
                    key={opt.id}
                    opt={opt}
                    userAnswer={userAnswer}
                    correctAnswer={correctAnswer}
                  />
                ))}
              </div>

              {!userAnswer && (
                <div style={{
                  padding: '6px 10px',
                  background: 'rgba(245,158,11,0.08)',
                  border: '1px solid rgba(245,158,11,0.20)',
                  borderRadius: 6,
                  color: '#fbbf24',
                  fontFamily: FONT,
                  fontSize: 11,
                }}>
                  Skipped / Unanswered
                </div>
              )}

              {q.explanation && (
                <div style={{
                  marginTop: 2,
                  padding: 12,
                  background: 'rgba(255,255,255,0.025)',
                  borderRadius: 8,
                  fontSize: 13,
                  color: TEXT3,
                  fontFamily: FONT,
                  lineHeight: 1.6,
                }}>
                  <strong style={{ color: TEXT2 }}>Explanation:</strong>{' '}
                  {String(q.explanation).replace(/\\n/g, '\n')}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function QuestionBankPage() {
  const [isInitializing, setIsInitializing] = useState(true)
  const [sessions, setSessions] = useState([])
  const [selectedTestId, setSelectedTestId] = useState(null)
  const [activeTestToResume, setActiveTestToResume] = useState(null)
  const [searchQuery, setSearchQuery] = useState('')
  

  const loadData = useCallback(async () => {
    const loadedSessions = await readSessionsAsync()
    setSessions(loadedSessions)
  }, [])

  useEffect(() => {
    let isMounted = true

    async function init() {
      try {
        await loadData()
      } catch (initError) {
        console.error('Failed to initialize saved tests:', initError)
      } finally {
        if (isMounted) setIsInitializing(false)
      }
    }

    init()
    return () => { isMounted = false }
  }, [loadData])

  useEffect(() => {
    const syncSessions = () => {
      loadData().catch(console.error)
    }
    window.addEventListener('learnledger:sessions-updated', syncSessions)
    return () => window.removeEventListener('learnledger:sessions-updated', syncSessions)
  }, [loadData])

  const handleExportTest = (test) => {
    const txt = formatTestAsTxt(test)
    const name = String(test.topic || test.title || 'saved-test')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-')
    downloadTxtFile(txt, name)
  }

  const handleExportAll = () => {
    const allTests = sessions.map((s) => s.test).filter(Boolean)
    if (allTests.length === 0) return
    const txt = formatAllTestsAsTxt(allTests)
    downloadTxtFile(txt, 'learnledger-question-bank')
  }

  const handleDelete = async (session) => {
    if (!window.confirm(`Delete "${session.title || 'this session'}"?`)) return
    await deleteSessionAsync(session.id)
    if (session.test?.id) {
      const nextTests = (await readSavedTestsAsync()).filter((t) => t.id !== session.test.id)
      await writeSavedTestsAsync(nextTests)
    }
    await loadData()
    if (selectedTestId === session.test?.id) setSelectedTestId(null)
  }

  const handleResumeTest = (test) => {
    const targetSession = sessions.find((s) => s.test?.id === test?.id)
    setActiveTestToResume(attachOriginatingChat(test, targetSession?.id))
  }

  const handleRestartTest = async (test) => {
    if (!window.confirm(`Restart "${test.topic || test.title || 'this test'}"? Your previous answers will be cleared.`)) return
    
    const targetSession = sessions.find((s) => s.test?.id === test?.id)
    const resetTest = {
      ...test,
      status: 'in-progress',
      answers: {},
      currentQuestionIndex: 0,
      bookmarkedQuestions: [],
      hintsUsed: [],
      startTime: new Date().toISOString(),
      completedAt: null,
      scoreResult: null,
      resultContext: null,
    }

    if (targetSession) {
      const updatedSession = { ...targetSession, test: resetTest }
      const allSessions = await readSessionsAsync()
      const filtered = allSessions.filter((s) => s.id !== updatedSession.id)
      await writeSessionsAsync([updatedSession, ...filtered])
    }
    
    await saveTestAsync(resetTest)
    await loadData()
    setActiveTestToResume(attachOriginatingChat(resetTest, targetSession?.id))
  }

  const handleUpdateResumingTest = async (updater) => {
    const nextTest = typeof updater === 'function' ? updater(activeTestToResume) : updater
    if (!nextTest) {
      setActiveTestToResume(nextTest)
      return nextTest
    }

    const targetSession = sessions.find((s) => s.test?.id === nextTest.id)
    if (targetSession) {
      const updatedSession = { ...targetSession, test: nextTest }
      const allSessions = await readSessionsAsync()
      const filtered = allSessions.filter((s) => s.id !== updatedSession.id)
      await writeSessionsAsync([updatedSession, ...filtered])
    }
    await saveTestAsync(nextTest)
    setActiveTestToResume(nextTest)
    return nextTest
  }

  const handleFinishResumingTest = async (testAttempt) => {
    const scoreResult = calculateScore(testAttempt.questions, testAttempt.answers)
    const completedAt = new Date().toISOString()
    const completedTest = attachStructuredResultContext(attachOriginatingChat({
      ...testAttempt,
      ...scoreResult,
      scoreResult,
      status: 'completed',
      completedAt,
    }, testAttempt.originatingChatId))

    const targetSession = sessions.find((s) =>
      s.id === completedTest.originatingChatId || s.test?.id === completedTest.id
    )
    if (targetSession) {
      const postTestSummaryMessage = {
        id: `msg_summary_${Date.now()}_${uid()}`,
        role: 'assistant',
        createdAt: completedAt,
        content: buildResultSummaryMessage(completedTest),
        testData: completedTest,
        resultContext: completedTest.resultContext,
      }
      const updatedSession = {
        ...targetSession,
        messages: [...(targetSession.messages || []), postTestSummaryMessage],
        test: completedTest,
        testId: completedTest.id,
      }
      const allSessions = await readSessionsAsync()
      const filtered = allSessions.filter((s) => s.id !== updatedSession.id)
      await writeSessionsAsync([updatedSession, ...filtered])
    }
    await saveTestAsync(completedTest)

    setActiveTestToResume(null)
    await loadData()
  }

  

  if (activeTestToResume) {
    return (
      <TestTakingView
        test={activeTestToResume}
        onUpdateTest={handleUpdateResumingTest}
        onFinish={handleFinishResumingTest}
        onExit={() => setActiveTestToResume(null)}
      />
    )
  }

  if (isInitializing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: TEXT3, fontFamily: FONT }}>
        Loading Question Bank...
      </div>
    )
  }

  const sessionsWithTests = sessions.filter((s) => s.test && s.test.questions?.length > 0)

  const filteredSessions = sessionsWithTests.filter((s) => {
    if (!searchQuery.trim()) return true
    const topic = s.test?.topic || ''
    const title = s.test?.title || s.title || ''
    return fuzzyMatch(searchQuery, topic) || fuzzyMatch(searchQuery, title)
  })

  const selectedSession = sessions.find((s) => s.test?.id === selectedTestId) || null
  const selectedTest = selectedSession?.test || null

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: FONT }}>

      {/* Title block */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ margin: 0, color: TEXT1, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em' }}>
            Question Bank
          </h1>
          <p style={{ margin: '4px 0 0', color: TEXT3, fontSize: 13 }}>
            Saved AI tests · {sessionsWithTests.length} test{sessionsWithTests.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Filter and controls header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 Search tests by topic..."
          style={{
            flex: 1,
            minWidth: 260,
            padding: '10px 16px',
            background: 'rgba(0, 0, 0, 0.22)',
            border: `1px solid ${BORDER}`,
            borderRadius: 10,
            color: TEXT1,
            fontFamily: FONT,
            fontSize: 13,
            outline: 'none',
          }}
        />

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          

          

          {sessionsWithTests.length > 0 && (
            <button type="button" onClick={handleExportAll} style={{
              padding: '9px 16px',
              background: 'rgba(14,165,233,0.10)',
              border: '1px solid rgba(14,165,233,0.28)',
              borderRadius: 10,
              color: '#38bdf8',
              fontFamily: FONT,
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}>
              ↓ Export All
            </button>
          )}
        </div>
      </div>

      

      {/* Tests list */}
      {filteredSessions.length === 0 ? (
        <div style={{
          padding: '56px 20px',
          textAlign: 'center',
          background: 'rgba(16,13,30,0.82)',
          border: `1px solid ${BORDER}`,
          borderRadius: 14,
        }}>
          <div style={{ color: TEXT3, fontFamily: FONT, fontSize: 14, lineHeight: 1.6 }}>
            {searchQuery.trim() ? 'No matching tests found.' : 'No saved tests yet.'}
            <br />
            {searchQuery.trim() ? 'Try adjusting your search query.' : 'Generate tests from the AI chat to see them here.'}
          </div>
        </div>
      ) : (
        <div style={{
          borderRadius: 14,
          border: `1px solid ${BORDER}`,
          background: 'rgba(16,13,30,0.82)',
          overflow: 'hidden',
        }}>
          {filteredSessions.map((session, idx) => {
            const test = session.test
            const isCompleted = test.status === 'completed'

            return (
              <div key={session.id || idx} style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '14px 16px',
                borderBottom: idx < filteredSessions.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                flexWrap: 'wrap',
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    color: TEXT1,
                    fontWeight: 700,
                    fontFamily: FONT,
                    fontSize: 14,
                  }}>
                    {test.topic || session.title || 'Untitled test'}
                  </div>
                  <div style={{ color: TEXT3, fontSize: 12, marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <span>{(test.questions || []).length} questions</span>
                    <span>·</span>
                    <ScoreDisplay test={test} />
                    <span>·</span>
                    <span>{formatDate(test.completedAt || test.createdAt || session.createdAt)}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {!isCompleted && (
                    <button type="button"
                      onClick={() => handleResumeTest(test)}
                      style={{
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #10b981, #14b8a6)',
                        color: '#fff',
                        padding: '7px 14px',
                        fontSize: 12,
                        fontFamily: FONT,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}>
                      ▶ Resume
                    </button>
                  )}

                  {isCompleted ? (
                    <button type="button"
                      onClick={() => handleRestartTest(test)}
                      style={{
                        borderRadius: 8,
                        border: 'none',
                        background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                        color: '#fff',
                        padding: '7px 14px',
                        fontSize: 12,
                        fontFamily: FONT,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}>
                      ↺ Restart
                    </button>
                  ) : (
                    <button type="button"
                      onClick={() => handleRestartTest(test)}
                      style={{
                        borderRadius: 8,
                        border: `1px solid ${BORDER}`,
                        background: 'rgba(255,255,255,0.04)',
                        color: TEXT2,
                        padding: '7px 12px',
                        fontSize: 12,
                        fontFamily: FONT,
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}>
                      Restart
                    </button>
                  )}

                  <button type="button"
                    onClick={() => setSelectedTestId(selectedTestId === test.id ? null : test.id)}
                    style={{
                      borderRadius: 8,
                      border: `1px solid ${selectedTestId === test.id ? 'rgba(139,92,246,0.40)' : BORDER}`,
                      background: selectedTestId === test.id ? 'rgba(139,92,246,0.12)' : 'rgba(255,255,255,0.04)',
                      color: selectedTestId === test.id ? '#a78bfa' : TEXT2,
                      padding: '7px 12px',
                      fontSize: 12,
                      fontFamily: FONT,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}>
                    {selectedTestId === test.id ? 'Close' : 'Open / Review'}
                  </button>
                  <button type="button" onClick={() => handleExportTest(test)} style={{
                    borderRadius: 8,
                    border: `1px solid ${BORDER}`,
                    background: 'rgba(255,255,255,0.04)',
                    color: TEXT2,
                    padding: '7px 12px',
                    fontSize: 12,
                    fontFamily: FONT,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    Export
                  </button>
                  <button type="button" onClick={() => handleDelete(session)} style={{
                    borderRadius: 8,
                    border: '1px solid rgba(239,68,68,0.20)',
                    background: 'rgba(239,68,68,0.08)',
                    color: '#ef4444',
                    padding: '7px 12px',
                    fontSize: 12,
                    fontFamily: FONT,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}>
                    Delete
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Review Panel */}
      {selectedTest && (
        <TestReviewPanel
          test={selectedTest}
          onClose={() => setSelectedTestId(null)}
          onExport={handleExportTest}
        />
      )}
    </div>
  )
}
