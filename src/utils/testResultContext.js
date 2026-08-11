const OPTION_IDS = new Set(['a', 'b', 'c', 'd'])

function normalizeAnswer(answer) {
  const normalized = String(answer || '').trim().toLowerCase()
  return OPTION_IDS.has(normalized) ? normalized : ''
}

function getOptionText(question, optionId) {
  const normalizedOptionId = normalizeAnswer(optionId)
  const options = Array.isArray(question?.options) ? question.options : []
  const option = options.find((item) => String(item?.id || '').trim().toLowerCase() === normalizedOptionId)
  return option?.text || ''
}

export function buildStructuredTestResult(test) {
  const questions = Array.isArray(test?.questions) ? test.questions : []
  const answers = test?.answers && typeof test.answers === 'object' ? test.answers : {}

  const questionResults = questions.map((question, index) => {
    const correctAnswer = normalizeAnswer(question?.correctAnswer)
    const userAnswer = normalizeAnswer(answers[question.id])
    const skipped = !userAnswer
    const correct = Boolean(userAnswer && correctAnswer && userAnswer === correctAnswer)

    return {
      questionId: question.id,
      questionNumber: Number(question.questionNumber) || index + 1,
      question: question.question || question.prompt || '',
      options: Array.isArray(question.options) ? question.options : [],
      correctAnswer,
      correctAnswerText: getOptionText(question, correctAnswer),
      userAnswer: userAnswer || null,
      userAnswerText: userAnswer ? getOptionText(question, userAnswer) : '',
      result: skipped ? 'skipped' : correct ? 'correct' : 'wrong',
      explanation: question.explanation || '',
      difficulty: question.difficulty || '',
      subjectName: question.subjectName || '',
      topicName: question.topicName || test?.topic || '',
    }
  })

  return {
    testId: test?.id || '',
    title: test?.title || test?.topic || 'Practice Test',
    topic: test?.topic || '',
    status: test?.status || '',
    completedAt: test?.completedAt || test?.endTime || '',
    score: {
      correct: Number(test?.correct ?? test?.score ?? 0),
      incorrect: Number(test?.incorrect ?? 0),
      skipped: Number(test?.unanswered ?? 0),
      totalQuestions: Number(test?.totalQuestions || questions.length),
      scorableQuestions: Number(test?.scorableQuestions || questions.length),
      ungradedQuestions: Number(test?.ungradedQuestions || 0),
      percentage: Number(test?.percentage || 0),
      passed: Boolean(test?.passed),
    },
    answers,
    questionResults,
    wrongQuestions: questionResults.filter((item) => item.result === 'wrong'),
    skippedQuestions: questionResults.filter((item) => item.result === 'skipped'),
  }
}

export function attachStructuredResultContext(test) {
  const resultContext = buildStructuredTestResult(test)
  return {
    ...test,
    resultContext,
    metadata: {
      ...(test?.metadata || {}),
      resultContext,
    },
  }
}

export function buildResultSummaryMessage(completedTest) {
  const resultContext = completedTest?.resultContext || buildStructuredTestResult(completedTest)
  const score = resultContext.score

  return [
    '**Test Completed!**',
    `Score: **${score.correct}/${score.totalQuestions}** (${score.percentage}%).`,
    `Correct: ${score.correct} | Wrong: ${score.incorrect} | Skipped: ${score.skipped}`,
    '',
    'You can now ask follow-up questions about this test:',
    '- "Which questions did I get wrong?"',
    '- "Explain question 7."',
    '- "What are my weak topics?"',
    '- "Create a retake test."',
  ].join('\n')
}
