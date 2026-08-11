/**
 * TestResultsView.jsx — Display test results with detailed question review.
 */

import { useEffect, useState } from 'react'
import { formatTime } from '@/utils/testScoring'
import { BORDER, TEXT1, TEXT2, TEXT3 } from '@/constants/theme'
import { formatTestAsTxt, formatTestResultsOnlyAsTxt, downloadTxtFile } from '@/utils/exportTest'

function getResolvedCorrectAnswer(question, explanationItem = null) {
  return String(explanationItem?.correctAnswer || question?.correctAnswer || '').trim().toLowerCase()
}

function hasAnswerKey(question, explanationItem = null) {
  return ['a', 'b', 'c', 'd'].includes(getResolvedCorrectAnswer(question, explanationItem))
}

function getResolvedExplanation(question, explanationItem = null) {
  return String(explanationItem?.explanation || question?.explanation || '').trim()
}

function ReviewOptions({ question, userAnswer, explanationItem = null, isReviewProcessing = false }) {
  const isGradedQuestion = hasAnswerKey(question, explanationItem)
  const resolvedCorrectAnswer = getResolvedCorrectAnswer(question, explanationItem)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {question.options.map((opt) => {
        const isUserAnswer = userAnswer === opt.id
        const isCorrectAnswer = isGradedQuestion && resolvedCorrectAnswer === opt.id

        return (
          <div
            key={opt.id}
            style={{
              padding: '10px 12px',
              background: isCorrectAnswer ? 'rgba(34,197,94,0.08)' : isUserAnswer ? 'rgba(239,68,68,0.08)' : 'transparent',
              border: `1px solid ${isCorrectAnswer ? 'rgba(34,197,94,0.3)' : isUserAnswer ? 'rgba(239,68,68,0.3)' : BORDER}`,
              borderRadius: '8px',
              color: TEXT2,
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '13px',
            }}
          >
            <strong>{opt.id.toUpperCase()}.</strong> {opt.text}
            {isCorrectAnswer && <span style={{ marginLeft: '8px', color: '#22c55e' }}>✓ Correct</span>}
            {isUserAnswer && !isCorrectAnswer && (
              <span style={{ marginLeft: '8px', color: isGradedQuestion ? '#ef4444' : '#a78bfa' }}>
                {isGradedQuestion ? 'Your answer' : 'Selected'}
              </span>
            )}
          </div>
        )
      })}
      {!isGradedQuestion && (
        <div style={{
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid rgba(245,158,11,0.24)',
          background: 'rgba(245,158,11,0.08)',
          color: '#fbbf24',
          fontFamily: "'DM Sans', sans-serif",
          fontSize: '12px',
          lineHeight: 1.5,
        }}>
          {isReviewProcessing
            ? 'Answer key and explanation are still being prepared for this question.'
            : 'No answer key was found for this manually parsed question, so it is shown for practice only.'}
        </div>
      )}
    </div>
  )
}

export default function TestResultsView({
  testAttempt,
  onClose,
  onRetake = null,
  closeLabel = 'Back to Tests',
  onTakeWeakAreaMockTest = null,
  onExport = null,
}) {
  const [expandedQuestions, setExpandedQuestions] = useState(new Set())

  const { 
    title, 
    questions, 
    answers, 
    score, 
    totalQuestions, 
    percentage, 
    passed, 
    timeTaken,
    scorableQuestions = totalQuestions,
    ungradedQuestions = 0,
    bookmarkedQuestions = [],
    hintsUsed = [],
    metadata,
    removedQuestionIds = [],
    removedQuestionsCount: rawRemovedQuestionsCount,
  } = testAttempt
  const reviewExplanations = (
    testAttempt?.reviewExplanations && typeof testAttempt.reviewExplanations === 'object'
      ? testAttempt.reviewExplanations
      : {}
  )
  const removedQuestionsCount = Number.isFinite(rawRemovedQuestionsCount)
    ? rawRemovedQuestionsCount
    : Array.isArray(removedQuestionIds)
      ? removedQuestionIds.length
      : 0
  const reviewGeneration = metadata?.reviewGeneration || null
  const isReviewProcessing = Boolean(reviewGeneration?.isAiProcessing)
  const isAwaitingAiResults = isReviewProcessing && Number(reviewGeneration?.totalQuestions || 0) > 0
  const isUngradedAttempt = Number(scorableQuestions || 0) === 0
  const isPartiallyGraded = !isUngradedAttempt && Number(ungradedQuestions || 0) > 0
  const headerTone = isAwaitingAiResults
    ? {
      background: 'linear-gradient(135deg, rgba(56,189,248,0.12), rgba(56,189,248,0.05))',
      border: 'rgba(56,189,248,0.28)',
      icon: '⏳',
      title: 'Preparing Results',
      accent: '#38bdf8',
    }
    : isUngradedAttempt
    ? {
      background: 'linear-gradient(135deg, rgba(245,158,11,0.12), rgba(245,158,11,0.05))',
      border: 'rgba(245,158,11,0.28)',
      icon: '📝',
      title: 'Practice Review',
      accent: '#f59e0b',
    }
    : passed
      ? {
        background: 'linear-gradient(135deg, rgba(34,197,94,0.1), rgba(34,197,94,0.05))',
        border: 'rgba(34,197,94,0.3)',
        icon: '🎉',
        title: 'Test Passed!',
        accent: '#22c55e',
      }
      : {
        background: 'linear-gradient(135deg, rgba(239,68,68,0.1), rgba(239,68,68,0.05))',
        border: 'rgba(239,68,68,0.3)',
        icon: '📚',
        title: 'Keep Learning!',
        accent: '#ef4444',
      }

  const toggleQuestion = (questionId) => {
    const newExpanded = new Set(expandedQuestions)
    if (newExpanded.has(questionId)) {
      newExpanded.delete(questionId)
    } else {
      newExpanded.add(questionId)
    }
    setExpandedQuestions(newExpanded)
  }

  const bookmarkedQuestionItems = questions
    .map((question, index) => ({ question, index }))
    .filter(({ question }) => bookmarkedQuestions.includes(question.id))

  const handleExportTest = () => {
    if (typeof onExport === 'function') {
      onExport(testAttempt)
      return
    }
    const txt = formatTestResultsOnlyAsTxt(testAttempt)
    const filename = String(testAttempt?.topic || testAttempt?.title || 'test-results')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
    downloadTxtFile(txt, filename)
  }

  useEffect(() => {
    setExpandedQuestions(new Set())
  }, [testAttempt?.id])

  return (
    <div className="animate-fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{
        background: headerTone.background,
        border: `1px solid ${headerTone.border}`,
        borderRadius: '16px',
        padding: 'clamp(20px, 6vw, 32px)',
        textAlign: 'center',
        marginBottom: '24px',
      }}>
        <div style={{ fontSize: '48px', marginBottom: '12px' }}>
          {headerTone.icon}
        </div>
        <h1 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '28px', fontWeight: '800', margin: '0 0 8px' }}>
          {headerTone.title}
        </h1>
        <p style={{ color: TEXT2, fontFamily: "'DM Sans', sans-serif", fontSize: '16px', margin: 0 }}>
          {title}
        </p>
        {isAwaitingAiResults && (
          <p style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', margin: '10px 0 0' }}>
            Preparing explanations and answer keys in the background. Results will update automatically.
          </p>
        )}
        {!isAwaitingAiResults && isUngradedAttempt && (
          <p style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', margin: '10px 0 0' }}>
            Manual parsing found questions and options, but no answer key was available for scoring.
          </p>
        )}
        {!isAwaitingAiResults && isPartiallyGraded && (
          <p style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', margin: '10px 0 0' }}>
            {ungradedQuestions} question{ungradedQuestions === 1 ? '' : 's'} did not include an answer key, so only graded questions affected your score.
          </p>
        )}
        {removedQuestionsCount > 0 && (
          <p style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', margin: '10px 0 0' }}>
            {removedQuestionsCount} invalid question{removedQuestionsCount === 1 ? '' : 's'} were removed during the test and excluded from scoring.
          </p>
        )}
        {reviewGeneration && !reviewGeneration.isComplete && !isAwaitingAiResults && (
          <p style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '13px', margin: '10px 0 0' }}>
            Stored answer keys and explanations were prepared for {reviewGeneration.availableQuestions} of {reviewGeneration.totalQuestions} questions before the test.
          </p>
        )}
      </div>

      {/* Score Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: isAwaitingAiResults ? '#38bdf8' : isUngradedAttempt ? '#f59e0b' : headerTone.accent, fontFamily: "'DM Sans', sans-serif" }}>
            {isAwaitingAiResults ? '...' : isUngradedAttempt ? 'NA' : `${percentage}%`}
          </div>
          <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
            {isAwaitingAiResults ? 'Preparing' : isUngradedAttempt ? 'Scored' : 'Score'}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#8b5cf6', fontFamily: "'DM Sans', sans-serif" }}>
            {isAwaitingAiResults ? 'Pending' : isUngradedAttempt ? 'No key' : `${score}/${scorableQuestions}`}
          </div>
          <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
            {isAwaitingAiResults ? 'Answer Key' : isUngradedAttempt ? 'Result Type' : 'Correct'}
          </div>
        </div>

        <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '32px', fontWeight: '800', color: '#a78bfa', fontFamily: "'DM Sans', sans-serif" }}>
            {formatTime(timeTaken)}
          </div>
          <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
            Time Taken
          </div>
        </div>

        {hintsUsed.length > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#fbbf24', fontFamily: "'DM Sans', sans-serif" }}>
              {hintsUsed.length}
            </div>
            <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
              Hints Used
            </div>
          </div>
        )}

        {!isAwaitingAiResults && (isUngradedAttempt || isPartiallyGraded) && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#f59e0b', fontFamily: "'DM Sans', sans-serif" }}>
              {ungradedQuestions || totalQuestions}
            </div>
            <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
              Ungraded
            </div>
          </div>
        )}

        {removedQuestionsCount > 0 && (
          <div style={{ background: 'rgba(255,255,255,0.02)', border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '20px', textAlign: 'center' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#f97316', fontFamily: "'DM Sans', sans-serif" }}>
              {removedQuestionsCount}
            </div>
            <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
              Removed
            </div>
          </div>
        )}
      </div>



      {/* Questions Review */}
      <div style={{ marginTop: '24px' }}>
        <h3 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
          Question Review
        </h3>
        {questions.length === 0 ? (
          <div style={{
            padding: '18px',
            background: 'rgba(255,255,255,0.02)',
            border: `1px solid ${BORDER}`,
            borderRadius: '12px',
            color: TEXT3,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            lineHeight: 1.6,
          }}>
            No questions remain in this attempt. Removed questions were excluded from review and scoring.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {questions.map((question, index) => {
            const userAnswer = answers[question.id]
            const explanationItem = reviewExplanations[question.id] || null
            const resolvedCorrectAnswer = getResolvedCorrectAnswer(question, explanationItem)
            const isGradedQuestion = hasAnswerKey(question, explanationItem)
            const isCorrect = isGradedQuestion && userAnswer === resolvedCorrectAnswer
            const isExpanded = expandedQuestions.has(question.id)
            const resolvedExplanation = getResolvedExplanation(question, explanationItem)
            const explanationFallbackMessage = isReviewProcessing
              ? 'Preparing explanations for this question...'
              : isGradedQuestion
              ? 'Explanation was unavailable for this question, so review is based on the stored answer key only.'
              : 'Explanation and answer key were unavailable for this question, so it is shown for practice only.'
            const usedHint = hintsUsed.includes(question.id)
            const isBookmarked = bookmarkedQuestions.includes(question.id)
            const reviewTone = isGradedQuestion
              ? (isCorrect
                  ? {
                    border: 'rgba(34,197,94,0.3)',
                    badgeBackground: 'rgba(34,197,94,0.12)',
                    badgeColor: '#22c55e',
                    icon: '✓',
                  }
                  : {
                    border: 'rgba(239,68,68,0.3)',
                    badgeBackground: 'rgba(239,68,68,0.12)',
                    badgeColor: '#ef4444',
                    icon: '✗',
                  })
              : {
                border: 'rgba(245,158,11,0.28)',
                badgeBackground: 'rgba(245,158,11,0.12)',
                badgeColor: '#f59e0b',
                icon: '•',
              }

            return (
              <div
                key={question.id}
                style={{
                  background: 'rgba(255,255,255,0.02)',
                  border: `1px solid ${reviewTone.border}`,
                  borderRadius: '12px',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => toggleQuestion(question.id)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '16px',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    background: reviewTone.badgeBackground,
                    color: reviewTone.badgeColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '16px',
                    fontWeight: '700',
                    flexShrink: 0,
                  }}>
                    {reviewTone.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '600' }}>
                      Question {index + 1}
                    </div>
                    <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px' }}>
                      {question.question.slice(0, 80)}...
                    </div>
                  </div>
                  {!isGradedQuestion && (
                    <span
                      style={{
                        borderRadius: '999px',
                        padding: '4px 8px',
                        background: 'rgba(245,158,11,0.12)',
                        border: '1px solid rgba(245,158,11,0.22)',
                        color: '#fbbf24',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '11px',
                        fontWeight: '700',
                      }}
                    >
                      No Key
                    </span>
                  )}
                  {isBookmarked && (
                    <span
                      style={{
                        borderRadius: '999px',
                        padding: '4px 8px',
                        background: 'rgba(124,58,237,0.12)',
                        border: '1px solid rgba(124,58,237,0.22)',
                        color: '#7c3aed',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '11px',
                        fontWeight: '700',
                      }}
                    >
                      🔖 Bookmarked
                    </span>
                  )}
                  {usedHint && <span style={{ fontSize: '16px' }}>💡</span>}
                  <span style={{ color: TEXT3, fontSize: '16px' }}>{isExpanded ? '▼' : '▶'}</span>
                </button>

                {isExpanded && (
                  <div style={{ padding: '0 16px 16px', borderTop: `1px solid ${BORDER}` }}>
                    <div style={{ padding: '16px 0' }}>
                      <p style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '600', margin: '0 0 12px' }}>
                        {question.question}
                      </p>
                      <ReviewOptions
                        question={question}
                        userAnswer={userAnswer}
                        explanationItem={explanationItem}
                        isReviewProcessing={isReviewProcessing}
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      {resolvedExplanation ? (
                        <div style={{ padding: '12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px' }}>
                          <div style={{ color: '#a78bfa', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
                            💡 Explanation
                          </div>
                          <p style={{ color: TEXT2, fontFamily: "'Poppins', 'DM Sans', sans-serif", fontSize: '15px', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                            {resolvedExplanation}
                          </p>
                        </div>
                      ) : (
                        <div style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          border: '1px solid rgba(245,158,11,0.24)',
                          background: 'rgba(245,158,11,0.08)',
                        color: '#fbbf24',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '12px',
                        lineHeight: 1.5,
                      }}>
                          {explanationFallbackMessage}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
            })}
          </div>
        )}
      </div>

      {bookmarkedQuestionItems.length > 0 && (
        <div style={{ marginTop: '28px' }}>
          <h3 style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '18px', fontWeight: '700', marginBottom: '16px' }}>
            Bookmarked Questions
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {bookmarkedQuestionItems.map(({ question, index }) => {
              const userAnswer = answers[question.id]
              const explanationItem = reviewExplanations[question.id] || null
              const resolvedCorrectAnswer = getResolvedCorrectAnswer(question, explanationItem)
              const isGradedQuestion = hasAnswerKey(question, explanationItem)
              const isCorrect = isGradedQuestion && userAnswer === resolvedCorrectAnswer
              const resolvedExplanation = getResolvedExplanation(question, explanationItem)
              const explanationFallbackMessage = isReviewProcessing
                ? 'Preparing explanations for this question...'
                : isGradedQuestion
                ? 'Explanation was unavailable for this question, so review is based on the stored answer key only.'
                : 'Explanation and answer key were unavailable for this question, so it is shown for practice only.'

              return (
                <div
                  key={question.id}
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${isGradedQuestion && isCorrect ? 'rgba(34,197,94,0.26)' : isGradedQuestion ? 'rgba(124,58,237,0.24)' : 'rgba(245,158,11,0.24)'}`,
                    borderRadius: '14px',
                    padding: '16px',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '10px',
                      marginBottom: '12px',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '700' }}>
                        Question {index + 1}
                      </div>
                      <div style={{ color: TEXT3, fontFamily: "'DM Sans', sans-serif", fontSize: '12px', marginTop: '4px' }}>
                        {isGradedQuestion ? (isCorrect ? 'Answered correctly' : 'Saved for revision') : 'Saved for practice review'}
                      </div>
                    </div>
                    <span
                      style={{
                        borderRadius: '999px',
                        padding: '5px 10px',
                        background: 'rgba(124,58,237,0.12)',
                        border: '1px solid rgba(124,58,237,0.24)',
                        color: '#7c3aed',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '11px',
                        fontWeight: '700',
                      }}
                    >
                      🔖 Bookmarked
                    </span>
                  </div>

                  <p style={{ color: TEXT1, fontFamily: "'DM Sans', sans-serif", fontSize: '14px', fontWeight: '600', margin: '0 0 12px', lineHeight: 1.6 }}>
                    {question.question}
                  </p>
                  <ReviewOptions
                    question={question}
                    userAnswer={userAnswer}
                    explanationItem={explanationItem}
                    isReviewProcessing={isReviewProcessing}
                  />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '12px' }}>
                    {resolvedExplanation ? (
                      <div style={{ padding: '12px', background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.2)', borderRadius: '8px' }}>
                        <div style={{ color: '#a78bfa', fontFamily: "'DM Sans', sans-serif", fontSize: '12px', fontWeight: '700', marginBottom: '4px' }}>
                          💡 Explanation
                        </div>
                        <p style={{ color: TEXT2, fontFamily: "'Poppins', 'DM Sans', sans-serif", fontSize: '15px', margin: 0, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                          {resolvedExplanation}
                        </p>
                      </div>
                    ) : (
                      <div style={{
                        padding: '10px 12px',
                        borderRadius: '8px',
                        border: '1px solid rgba(245,158,11,0.24)',
                        background: 'rgba(245,158,11,0.08)',
                        color: '#fbbf24',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: '12px',
                        lineHeight: 1.5,
                      }}>
                        {explanationFallbackMessage}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
        <button
          className="w-full sm:w-auto"
          type="button"
          onClick={onClose}
          style={{
            padding: '12px 24px',
            background: 'rgba(255,255,255,0.08)',
            border: `1px solid ${BORDER}`,
            borderRadius: '10px',
            color: TEXT2,
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          {closeLabel}
        </button>
        <button
          type="button"
          onClick={handleExportTest}
          style={{
            padding: '12px 20px',
            background: 'rgba(14,165,233,0.12)',
            border: '1px solid rgba(14,165,233,0.3)',
            borderRadius: '10px',
            color: '#38bdf8',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: '13px',
            fontWeight: '600',
            cursor: 'pointer',
          }}
        >
          ↓ Export Test
        </button>
        {typeof onRetake === 'function' && (
          <button
            className="w-full sm:w-auto"
            type="button"
            onClick={onRetake}
            style={{
              padding: '12px 24px',
              background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
              border: 'none',
              borderRadius: '10px',
              color: '#fff',
              fontFamily: "'DM Sans', sans-serif",
              fontSize: '14px',
              fontWeight: '700',
              cursor: 'pointer',
            }}
          >
            🔄 Retake Test
          </button>
        )}
      </div>
    </div>
  )
}
