import { useState, useCallback, useEffect } from 'react'
import {
  parseOfflineTestJson,
  parseTxtToTest,
  getImportSettingsFromTest,
  applyImportSettingsToTest,
  IMPORT_DIFFICULTIES
} from '@/utils/offlineTestImport'
import { repairOfflineTestJsonWithAI } from '@/services/aiService'
import { uid } from '@/utils/id'
import { BORDER, TEXT1, TEXT2, TEXT3, BUTTON_GRADIENT } from '@/constants/theme'
import { readSessionsAsync, writeSessionsAsync } from '@/services/sessionStorage'
import { saveTestAsync } from '@/services/localTestStorage'
import { calculateScore } from '@/utils/testScoring'
import { attachStructuredResultContext, buildResultSummaryMessage } from '@/utils/testResultContext'
import TestTakingView from '@/components/tests/TestTakingView'
import TestResultsView from '@/components/tests/TestResultsView'
import { formatTestAsTxt, formatTestResultsOnlyAsTxt, downloadTxtFile } from '@/utils/exportTest'
import { CopyIcon, CheckIcon, UploadIcon } from '@/components/ui/Icons'
import { OFFLINE_TEST_GENERATION_PROMPT } from '@/constants/testPrompt'

const FONT = "'Inter', 'DM Sans', sans-serif"

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

export default function TestsPage() {
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')
  const [importSuccess, setImportSuccess] = useState('')
  const [importDraft, setImportDraft] = useState(null)
  const [importSettings, setImportSettings] = useState(() => getImportSettingsFromTest(null))
  const [isRepairingImport, setIsRepairingImport] = useState(false)
  const [invalidImportContent, setInvalidImportContent] = useState('')
  const [importSourceName, setImportSourceName] = useState('')

  const [activeTest, setActiveTest] = useState(null)
  const [viewingResults, setViewingResults] = useState(null)
  const [isPromptCopied, setIsPromptCopied] = useState(false)

  const handleCopyPrompt = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(OFFLINE_TEST_GENERATION_PROMPT)
      } else {
        const textarea = document.createElement('textarea')
        textarea.value = OFFLINE_TEST_GENERATION_PROMPT
        textarea.style.position = 'fixed'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.select()
        document.execCommand('copy')
        document.body.removeChild(textarea)
      }
      setIsPromptCopied(true)
      setTimeout(() => setIsPromptCopied(false), 2000)
    } catch (err) {
      console.error('Failed to copy prompt:', err)
    }
  }

  const parseImportText = (rawText, { jsonOnly = false } = {}) => {
    const text = String(rawText || '').trim()
    if (!text) {
      throw new Error('Import content is empty.')
    }

    const firstChar = text[0]
    if (firstChar === '{' || firstChar === '[' || text.startsWith('```')) {
      return parseOfflineTestJson(text)
    }

    if (jsonOnly) {
      throw new Error('Upload JSON only accepts LearnLedger offline .json files.')
    }

    return parseTxtToTest(text)
  }

  const prepareImportDraft = (rawText, { sourceName = '', jsonOnly = true } = {}) => {
    setImportError('')
    setImportSuccess('')
    setInvalidImportContent('')

    const importedTest = parseImportText(rawText, { jsonOnly })
    setImportText(String(rawText || '').trim())
    setImportDraft(importedTest)
    setImportSettings(getImportSettingsFromTest(importedTest))
    setImportSourceName(sourceName)
    setImportSuccess(`Validated "${importedTest.topic || importedTest.title || 'Practice Test'}". Review settings before starting.`)
    return importedTest
  }

  const handleUploadJson = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.json')) {
      setImportError('Upload JSON only accepts .json files.')
      setImportDraft(null)
      setInvalidImportContent('')
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const rawContent = String(event.target?.result || '')
      try {
        prepareImportDraft(rawContent, { sourceName: file.name, jsonOnly: true })
      } catch (err) {
        console.error('JSON import error:', err)
        setImportText(rawContent)
        setImportDraft(null)
        setImportSourceName(file.name)
        setInvalidImportContent(rawContent)
        setImportError(err.message || 'Failed to validate JSON import.')
        setImportSuccess('')
      }
    }
    reader.onerror = () => {
      setImportError(`Could not read "${file.name}". The file may be malformed or unavailable.`)
      setImportDraft(null)
      setInvalidImportContent('')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleImportPaste = async () => {
    try {
      prepareImportDraft(importText, { sourceName: 'Pasted JSON', jsonOnly: true })
    } catch (err) {
      console.error('Import error:', err)
      setImportError(err.message || 'Failed to import test.')
      setImportDraft(null)
      setInvalidImportContent(importText)
      setImportSuccess('')
    }
  }

  const handleRepairImportWithAI = async () => {
    const rawContent = invalidImportContent || importText
    if (!rawContent.trim()) {
      setImportError('No invalid JSON content is available to repair.')
      return
    }

    setIsRepairingImport(true)
    setImportSuccess('')
    let repairedJson = ''
    try {
      repairedJson = await repairOfflineTestJsonWithAI(rawContent, importError, {
        model: window.localStorage.getItem('ll.model') || 'auto/best-free',
        thinking: window.localStorage.getItem('ll.thinking') || 'Low',
      })
      const repairedTest = prepareImportDraft(repairedJson, {
        sourceName: importSourceName ? `${importSourceName} (AI repaired)` : 'AI repaired JSON',
        jsonOnly: true,
      })
      setImportText(String(repairedJson || '').trim())
      setImportSuccess(`AI returned valid JSON for "${repairedTest.topic || repairedTest.title || 'Practice Test'}". Review the JSON and settings before starting.`)
    } catch (err) {
      console.error('AI repair failed:', err)
      if (repairedJson) {
        setImportText(String(repairedJson || '').trim())
        setInvalidImportContent(String(repairedJson || '').trim())
      } else {
        setInvalidImportContent(rawContent)
      }
      setImportError(err.message || 'AI could not repair this JSON.')
    } finally {
      setIsRepairingImport(false)
    }
  }

  const createImportedSession = async (importedTest) => {
    const timestamp = new Date().toISOString()
    const sessionId = `session_imported_${Date.now()}_${uid()}`
    const testWithOrigin = attachOriginatingChat(importedTest, sessionId)
    const savedTest = await saveTestAsync(testWithOrigin)
    const newSession = {
      id: sessionId,
      title: `Imported: ${savedTest.topic || savedTest.title || 'Practice Test'}`,
      createdAt: savedTest.createdAt || timestamp,
      updatedAt: timestamp,
      messages: [
        {
          id: `msg_imported_welcome_${uid()}`,
          role: 'assistant',
          createdAt: timestamp,
          content: `This test was imported locally from a structured file on "${savedTest.topic || savedTest.title || 'Practice Test'}".`,
          testData: savedTest,
        }
      ],
      testId: savedTest.id,
      test: savedTest,
    }

    const existingSessions = await readSessionsAsync()
    await writeSessionsAsync([newSession, ...existingSessions])
    return savedTest
  }

  const handleStartImportedTest = async () => {
    try {
      setImportError('')
      setImportSuccess('')
      if (!importDraft) throw new Error('Validate a LearnLedger offline JSON test before starting.')

      const reviewedTest = applyImportSettingsToTest(importDraft, importSettings)
      const savedTest = await createImportedSession(reviewedTest)
      
      setImportText('')
      setImportDraft(null)
      setInvalidImportContent('')
      setImportSourceName('')

      setActiveTest({
        ...savedTest,
        startTime: new Date().toISOString(),
        answers: {},
        currentQuestionIndex: 0,
        bookmarkedQuestions: [],
        hintsUsed: [],
        status: 'in-progress',
      })
    } catch (err) {
      console.error('Start error:', err)
      setImportError(err.message || 'Failed to start test.')
    }
  }

  const handleUpdateActiveTest = async (updater) => {
    const nextTest = typeof updater === 'function' ? updater(activeTest) : updater
    if (!nextTest) {
      setActiveTest(nextTest)
      return nextTest
    }

    const existingSessions = await readSessionsAsync()
    const targetSession = existingSessions.find((s) => s.test?.id === nextTest.id)
    if (targetSession) {
      const updatedSession = { ...targetSession, test: nextTest }
      const filtered = existingSessions.filter((s) => s.id !== updatedSession.id)
      await writeSessionsAsync([updatedSession, ...filtered])
    }
    await saveTestAsync(nextTest)
    setActiveTest(nextTest)
    return nextTest
  }

  const handleFinishTest = async (testAttempt) => {
    const scoreResult = calculateScore(testAttempt.questions, testAttempt.answers)
    const completedAt = new Date().toISOString()
    const completedTest = attachStructuredResultContext(attachOriginatingChat({
      ...testAttempt,
      ...scoreResult,
      scoreResult,
      status: 'completed',
      completedAt,
    }, testAttempt.originatingChatId))

    const existingSessions = await readSessionsAsync()
    const targetSession = existingSessions.find((s) =>
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
      const filtered = existingSessions.filter((s) => s.id !== updatedSession.id)
      await writeSessionsAsync([updatedSession, ...filtered])
    }
    await saveTestAsync(completedTest)

    setActiveTest(null)
    setViewingResults(completedTest)
  }

  if (activeTest) {
    return (
      <TestTakingView 
        test={activeTest} 
        onUpdateTest={handleUpdateActiveTest}
        onFinish={handleFinishTest} 
        onExit={() => setActiveTest(null)} 
      />
    )
  }

  if (viewingResults) {
    return (
      <TestResultsView 
        testAttempt={viewingResults} 
        onClose={() => setViewingResults(null)}
        onRetake={() => { 
          setViewingResults(null)
          setActiveTest({ ...viewingResults, status: 'in-progress', answers: {} }) 
        }}
      />
    )
  }

  return (
    <div className="animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: FONT, padding: '24px', maxWidth: '800px', margin: '0 auto', width: '100%' }}>
      <div>
        <h1 style={{ margin: 0, color: TEXT1, fontSize: 24, fontWeight: 900, letterSpacing: '-0.04em' }}>
          Create Test from JSON
        </h1>
        <p style={{ margin: '4px 0 0', color: TEXT3, fontSize: 13 }}>
          Upload or paste an offline LearnLedger JSON file to start a test.
        </p>
      </div>

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{
          padding: '10px 18px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)',
          border: 'none',
          borderRadius: 10,
          color: '#fff',
          fontFamily: FONT,
          fontSize: 13,
          fontWeight: 700,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          boxShadow: '0 4px 14px rgba(99,102,241,0.35)',
          userSelect: 'none',
        }}>
          <span style={{ width: 15, height: 15, display: 'inline-flex', alignItems: 'center' }}>
            <UploadIcon />
          </span>
          Upload JSON File
          <input
            type="file"
            accept=".json,application/json"
            onChange={handleUploadJson}
            style={{ display: 'none' }}
          />
        </label>

        <button
          type="button"
          onClick={handleCopyPrompt}
          title="Copy prompt for generating offline LearnLedger tests with AI"
          style={{
            padding: '10px 16px',
            background: isPromptCopied ? 'rgba(16, 185, 129, 0.16)' : 'rgba(255, 255, 255, 0.06)',
            border: isPromptCopied ? '1px solid rgba(16, 185, 129, 0.4)' : `1px solid ${BORDER}`,
            borderRadius: 10,
            color: isPromptCopied ? '#34d399' : TEXT1,
            fontFamily: FONT,
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 7,
            boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
            transition: 'all 0.2s ease',
          }}
        >
          <span style={{ width: 15, height: 15, display: 'inline-flex', alignItems: 'center' }}>
            {isPromptCopied ? <CheckIcon /> : <CopyIcon />}
          </span>
          {isPromptCopied ? 'Prompt Copied!' : 'Copy AI Prompt'}
        </button>
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 14,
        background: 'rgba(0, 0, 0, 0.18)',
        border: `1px solid ${BORDER}`,
        borderRadius: 10,
      }}>
        <textarea
          value={importText}
          onChange={(e) => {
            setImportText(e.target.value)
            setImportError('')
            setImportSuccess('')
            setImportDraft(null)
            setInvalidImportContent(e.target.value)
          }}
          placeholder="Or paste LearnLedger offline JSON text here..."
          rows={6}
          style={{
            width: '100%',
            resize: 'vertical',
            minHeight: 120,
            padding: '12px 14px',
            background: 'rgba(0, 0, 0, 0.24)',
            border: `1px solid ${BORDER}`,
            borderRadius: 8,
            color: TEXT1,
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: 12,
            lineHeight: 1.5,
            outline: 'none',
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div style={{
            color: importError ? '#f87171' : importSuccess ? '#4ade80' : TEXT3,
            fontSize: 12,
            lineHeight: 1.5,
            whiteSpace: 'pre-line',
            flex: 1,
          }}>
            {importError || importSuccess || 'JSON imports are validated locally.'}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {importError && invalidImportContent.trim() && (
              <button type="button" onClick={handleRepairImportWithAI} disabled={isRepairingImport} style={{
                padding: '8px 14px',
                background: isRepairingImport ? 'rgba(255,255,255,0.04)' : 'rgba(139,92,246,0.14)',
                border: `1px solid ${isRepairingImport ? BORDER : 'rgba(139,92,246,0.34)'}`,
                borderRadius: 8,
                color: isRepairingImport ? TEXT3 : '#c4b5fd',
                fontFamily: FONT,
                fontSize: 12,
                fontWeight: 700,
                cursor: isRepairingImport ? 'wait' : 'pointer',
              }}>
                {isRepairingImport ? 'Fixing...' : 'Fix with AI'}
              </button>
            )}
            <button type="button" onClick={handleImportPaste} disabled={!importText.trim()} style={{
              padding: '8px 14px',
              background: importText.trim() ? 'rgba(16,185,129,0.14)' : 'rgba(255,255,255,0.04)',
              border: `1px solid ${importText.trim() ? 'rgba(16,185,129,0.32)' : BORDER}`,
              borderRadius: 8,
              color: importText.trim() ? '#6ee7b7' : TEXT3,
              fontFamily: FONT,
              fontSize: 12,
              fontWeight: 700,
              cursor: importText.trim() ? 'pointer' : 'not-allowed',
            }}>
              Validate JSON
            </button>
          </div>
        </div>

        {importDraft && (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            padding: 16,
            marginTop: 8,
            background: 'rgba(255,255,255,0.025)',
            border: '1px solid rgba(16,185,129,0.22)',
            borderRadius: 10,
          }}>
            <div style={{ color: TEXT1, fontFamily: FONT, fontSize: 14, fontWeight: 800 }}>
              Test Settings
            </div>
            <div style={{ color: TEXT3, fontSize: 12 }}>
              {importSourceName || 'Validated JSON'} · {(importDraft.questions || []).length} questions · Language: {(importSettings.language || 'english').toUpperCase()}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: TEXT3, fontSize: 11, fontWeight: 700 }}>
                Test title
                <input value={importSettings.title} onChange={(e) => setImportSettings((current) => ({ ...current, title: e.target.value }))} style={{
                  padding: '9px 10px',
                  background: 'rgba(0,0,0,0.22)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  color: TEXT1,
                  fontFamily: FONT,
                  fontSize: 12,
                  outline: 'none',
                }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: TEXT3, fontSize: 11, fontWeight: 700 }}>
                Topic
                <input value={importSettings.topic} onChange={(e) => setImportSettings((current) => ({ ...current, topic: e.target.value }))} style={{
                  padding: '9px 10px',
                  background: 'rgba(0,0,0,0.22)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  color: TEXT1,
                  fontFamily: FONT,
                  fontSize: 12,
                  outline: 'none',
                }} />
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: TEXT3, fontSize: 11, fontWeight: 700 }}>
                Difficulty
                <select value={importSettings.difficulty} onChange={(e) => setImportSettings((current) => ({ ...current, difficulty: e.target.value }))} style={{
                  padding: '9px 10px',
                  background: 'rgba(0,0,0,0.22)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  color: TEXT1,
                  fontFamily: FONT,
                  fontSize: 12,
                  outline: 'none',
                }}>
                  {IMPORT_DIFFICULTIES.map((difficulty) => (
                    <option key={difficulty} value={difficulty}>{difficulty}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: TEXT3, fontSize: 11, fontWeight: 700 }}>
                Time limit (minutes)
                <input type="number" min="1" step="1" value={importSettings.timeLimit} onChange={(e) => setImportSettings((current) => ({ ...current, timeLimit: e.target.value }))} placeholder="No limit" style={{
                  padding: '9px 10px',
                  background: 'rgba(0,0,0,0.22)',
                  border: `1px solid ${BORDER}`,
                  borderRadius: 8,
                  color: TEXT1,
                  fontFamily: FONT,
                  fontSize: 12,
                  outline: 'none',
                }} />
              </label>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }}>
              <button type="button" onClick={handleStartImportedTest} style={{
                padding: '10px 20px',
                background: 'linear-gradient(135deg, #10b981, #14b8a6)',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontFamily: FONT,
                fontSize: 13,
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(16,185,129,0.35)',
              }}>
                ▶ Start Test
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
