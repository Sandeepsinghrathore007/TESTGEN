import { normalizeStructuredExplanation } from './explanationFormatting.js'
import { uid } from './id.js'

export const OFFLINE_TEST_SCHEMA = 'learnledger-offline-test/v1'

const OPTION_IDS = ['a', 'b', 'c', 'd']
const DIFFICULTIES = new Set(['easy', 'medium', 'hard', 'mixed'])
const QUESTION_DIFFICULTIES = new Set(['easy', 'medium', 'hard'])
const TIMING_MODES = new Set(['total', 'per-question'])

function cleanString(value) {
  return String(value ?? '').trim()
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function readRequiredString(value, label) {
  const text = cleanString(value)
  if (!text) {
    throw new Error(`${label} is required and must be a non-empty string.`)
  }
  return text
}

function normalizeDifficulty(value, { questionNumber = null, allowMixed = false } = {}) {
  const normalized = cleanString(value).toLowerCase()
  const allowed = allowMixed ? DIFFICULTIES : QUESTION_DIFFICULTIES
  if (allowed.has(normalized)) return normalized

  const target = questionNumber ? `Question ${questionNumber} difficulty` : 'difficulty'
  const suffix = allowMixed ? 'easy, medium, hard, or mixed' : 'easy, medium, or hard'
  throw new Error(`${target} must be one of: ${suffix}.`)
}

function normalizeTimingConfig(rawConfig, questionCount) {
  const config = isPlainObject(rawConfig) ? rawConfig : {}
  const timingMode = cleanString(config.timingMode || 'total').toLowerCase()
  if (!TIMING_MODES.has(timingMode)) {
    throw new Error('config.timingMode must be "total" or "per-question".')
  }

  const normalized = {
    timeLimit: null,
    timingMode,
    timePerQuestion: null,
  }

  if (config.timeLimit !== undefined && config.timeLimit !== null) {
    if (!Number.isFinite(config.timeLimit) || config.timeLimit <= 0) {
      throw new Error('config.timeLimit must be null or a positive number of minutes.')
    }
    normalized.timeLimit = config.timeLimit
  }

  if (timingMode === 'per-question') {
    if (!Number.isFinite(config.timePerQuestion) || config.timePerQuestion <= 0) {
      throw new Error('config.timePerQuestion must be a positive number of seconds when timingMode is "per-question".')
    }
    normalized.timePerQuestion = config.timePerQuestion
    normalized.timeLimit = null
  }

  return {
    ...normalized,
    questionCount,
  }
}

function normalizeOptions(rawOptions, questionNumber) {
  if (!isPlainObject(rawOptions)) {
    throw new Error(`Question ${questionNumber} options must be an object with keys A, B, C, and D.`)
  }

  return OPTION_IDS.map((id) => {
    const upper = id.toUpperCase()
    const text = cleanString(rawOptions[upper] ?? rawOptions[id])
    if (!text) {
      throw new Error(`Question ${questionNumber} option ${upper} is required and must be a non-empty string.`)
    }
    return { id, text }
  })
}

function normalizeCorrectAnswer(rawCorrectAnswer, questionNumber) {
  const normalized = cleanString(rawCorrectAnswer).toLowerCase()
  if (!OPTION_IDS.includes(normalized)) {
    throw new Error(`Question ${questionNumber} correctAnswer must be one of: A, B, C, or D.`)
  }
  return normalized
}

function stripJsonCodeFence(rawText) {
  return String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractJsonString(rawText) {
  const text = String(rawText || '').trim();
  
  // First attempt: match code fences
  const codeBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/i;
  const match = text.match(codeBlockRegex);
  if (match && match[1]) {
    const candidate = match[1].trim();
    try {
      JSON.parse(candidate);
      return candidate;
    } catch (e) {}
  }

  // Second attempt: find first { and last }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    const candidate = text.substring(firstBrace, lastBrace + 1);
    try {
      JSON.parse(candidate);
      return candidate;
    } catch (e) {
      return candidate; // return sliced text anyway for validator/repair to process
    }
  }

  return stripJsonCodeFence(text);
}

export function parseOfflineTestJson(rawText) {
  const jsonText = extractJsonString(rawText)
  if (!jsonText) {
    throw new Error('Import file is empty.')
  }

  let payload
  try {
    payload = JSON.parse(jsonText)
  } catch (error) {
    throw new Error(`Invalid JSON: ${error.message}`)
  }

  if (!isPlainObject(payload)) {
    throw new Error('Root value must be a JSON object.')
  }

  const schema = cleanString(payload.schema)
  if (schema !== OFFLINE_TEST_SCHEMA) {
    throw new Error(`schema must be "${OFFLINE_TEST_SCHEMA}".`)
  }

  const title = readRequiredString(payload.title, 'title')
  const topic = readRequiredString(payload.topic, 'topic')
  const difficulty = normalizeDifficulty(payload.difficulty, { allowMixed: true })

  if (!Array.isArray(payload.questions) || payload.questions.length === 0) {
    throw new Error('questions must be a non-empty array.')
  }

  const questionCount = payload.questions.length
  const seenQuestionNumbers = new Set()
  const questionNumbers = payload.questions.map((rawQuestion, index) => {
    if (!isPlainObject(rawQuestion)) {
      throw new Error(`Question ${index + 1} must be an object.`)
    }

    const questionNumber = Number(rawQuestion.questionNumber)
    if (!Number.isInteger(questionNumber)) {
      throw new Error(`Question ${index + 1} questionNumber must be an integer.`)
    }
    if (seenQuestionNumbers.has(questionNumber)) {
      throw new Error(`Duplicate questionNumber ${questionNumber}. Question numbers must be unique and sequential.`)
    }
    seenQuestionNumbers.add(questionNumber)
    return questionNumber
  })

  questionNumbers.forEach((questionNumber, index) => {
    const expectedQuestionNumber = index + 1
    if (questionNumber !== expectedQuestionNumber) {
      throw new Error(`Question numbers must be sequential starting at 1. Question ${index + 1} has questionNumber ${questionNumber}, expected ${expectedQuestionNumber}.`)
    }
  })

  const timestamp = new Date().toISOString()
  const questions = payload.questions.map((rawQuestion, index) => {
    const questionNumber = questionNumbers[index]
    const questionText = readRequiredString(rawQuestion.question, `Question ${questionNumber} question`)
    const options = normalizeOptions(rawQuestion.options, questionNumber)
    const correctAnswer = normalizeCorrectAnswer(rawQuestion.correctAnswer, questionNumber)
    const explanation = readRequiredString(rawQuestion.explanation, `Question ${questionNumber} explanation`)
    const questionDifficulty = rawQuestion.difficulty === undefined || rawQuestion.difficulty === null || cleanString(rawQuestion.difficulty) === ''
      ? difficulty === 'mixed' ? 'medium' : difficulty
      : normalizeDifficulty(rawQuestion.difficulty, { questionNumber })

    return {
      id: `q_offline_${Date.now()}_${index}_${uid()}`,
      questionNumber,
      question: questionText,
      options,
      correctAnswer,
      explanation: normalizeStructuredExplanation(explanation),
      difficulty: questionDifficulty,
      ...(cleanString(rawQuestion.subjectName) ? { subjectName: cleanString(rawQuestion.subjectName) } : {}),
      ...(cleanString(rawQuestion.topicName) ? { topicName: cleanString(rawQuestion.topicName) } : {}),
      ...(cleanString(rawQuestion.sourceQuestion) ? { sourceQuestion: cleanString(rawQuestion.sourceQuestion) } : {}),
    }
  })

  const timingConfig = normalizeTimingConfig(payload.config, questionCount)

  return {
    id: `test_offline_${Date.now()}_${uid()}`,
    createdAt: timestamp,
    importedAt: timestamp,
    savedAt: timestamp,
    topic,
    title,
    metadata: {
      source: 'offline-import',
      testType: 'offline-import',
      importSchema: OFFLINE_TEST_SCHEMA,
      importedAt: timestamp,
      intent: {
        topic,
        questionCount,
        difficulty,
        questionType: 'multiple_choice',
      },
    },
    config: {
      ...timingConfig,
      topic,
      difficulty,
      scope: 'offline-import',
      parsingMode: 'manual',
      language: cleanString(payload.language).toLowerCase() === 'hindi' ? 'hindi' : 'english',
    },
    questions,
    questionCount,
    status: 'in-progress',
    answers: {},
    currentQuestionIndex: 0,
    bookmarkedQuestions: [],
    hintsUsed: [],
  }
}

export const IMPORT_DIFFICULTIES = ['easy', 'medium', 'hard'];

export function getImportSettingsFromTest(test) {
  if (!test) {
    return {
      title: '',
      topic: '',
      difficulty: 'medium',
      language: 'english',
      timeLimit: '',
    };
  }
  return {
    title: test.title || '',
    topic: test.topic || '',
    difficulty: test.config?.difficulty || test.difficulty || 'medium',
    language: test.config?.language || 'english',
    timeLimit: test.config?.timeLimit !== null && test.config?.timeLimit !== undefined ? String(test.config.timeLimit) : '',
  };
}

export function applyImportSettingsToTest(test, settings) {
  if (!test || !settings) return test;
  const timeLimitVal = settings.timeLimit ? parseFloat(settings.timeLimit) : null;
  return {
    ...test,
    title: settings.title,
    topic: settings.topic,
    difficulty: settings.difficulty,
    config: {
      ...(test.config || {}),
      title: settings.title,
      topic: settings.topic,
      difficulty: settings.difficulty,
      timeLimit: timeLimitVal,
      timingMode: timeLimitVal ? 'total' : 'total',
    },
  };
}

export function parseTxtToTest() { return null; }
export function repairOfflineTestJsonWithAI() { return null; }
