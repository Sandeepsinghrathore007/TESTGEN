const DEFAULT_QUESTION_COUNT = 5
const MAX_QUESTION_COUNT = 50

const REQUEST_PATTERN = /\b(?:generate|create|make|prepare|give|build|banao|bana|banado|bnao|bna|do)\b/i
const TEST_NOUN_PATTERN = /\b(?:test|quiz|mock|mcqs?|questions?|ques(?:tion)?s?)\b/i
const REVIEW_PATTERN = /\b(?:wrong|missed|explain|mistake|weak)\b/i
const TOPIC_STOP_PATTERN = /\b(?:par|pe|pr|per|ke|ki|kay|on|about|for|with|generate|create|make|prepare|give|build|banao|bana|banado|bnao|bna|do|question(?:s)?|ques(?:tion)?s?|mcqs?|test|quiz|mock|easy|medium|hard|mixed|conceptual|theory|theoretical)\b/i

function clampQuestionCount(value) {
  if (!Number.isFinite(value)) return DEFAULT_QUESTION_COUNT
  return Math.min(Math.max(Math.round(value), 1), MAX_QUESTION_COUNT)
}

function cleanTopic(value) {
  const topic = String(value || '')
    .replace(/^[\s,:;\-–—]+|[\s,:;\-–—]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!topic || topic.length > 100 || !/[a-z]/i.test(topic)) return ''

  const compact = topic.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (compact === 'tcpip' || compact === 'tcpipmodel') return 'TCP/IP Model'
  if (compact === 'dns') return 'DNS'
  if (compact === 'osi' || compact === 'osimodel') return 'OSI Model'
  if (compact === 'http') return 'HTTP'
  if (compact === 'html') return 'HTML'
  if (compact === 'css') return 'CSS'
  if (compact === 'sql') return 'SQL'
  if (compact === 'dbms') return 'DBMS'

  return topic
    .split(' ')
    .map((word) => /^[A-Z0-9]{2,}$/.test(word) ? word : `${word.charAt(0).toUpperCase()}${word.slice(1).toLowerCase()}`)
    .join(' ')
}

function extractTopic(text) {
  const source = String(text || '').replace(/\s+/g, ' ').trim()
  const patterns = [
    /\b(?:on|about|for)\s+(.+?)(?=\s*(?:,|\.|$))/i,
    /^\s*(?:yes\s+)?(.+?)\s+\b(?:par|pe|pr|per|ke|ki|kay)\s+\d{1,2}\b/i,
    /^\s*(?:yes\s+)?(.+?)\s+\b\d{1,2}\s*(?:easy|medium|hard|mixed|conceptual|theory|theoretical|questions?|mcqs?|test|quiz)\b/i,
    /\b(?:questions?|mcqs?|test|quiz)\s+(?:on|about|for)\s+(.+?)(?=\s*(?:,|\.|$))/i,
  ]

  for (const pattern of patterns) {
    const match = source.match(pattern)
    if (!match?.[1]) continue
    const candidate = match[1].split(TOPIC_STOP_PATTERN)[0]
    const topic = cleanTopic(candidate)
    if (topic) return topic
  }

  return ''
}

function extractDifficulty(text) {
  const source = String(text || '').toLowerCase()
  const requested = ['easy', 'medium', 'hard'].filter((level) => new RegExp(`\\b${level}\\b`).test(source))
  if (/\bmixed\b/.test(source) || requested.length > 1) return 'mixed'
  return requested[0] || 'mixed'
}

function extractQuestionType(text) {
  return /\b(?:conceptual|concept|theory|theoretical)\b/i.test(text)
    ? 'conceptual'
    : 'multiple_choice'
}

/**
 * Turn an obvious natural-language test request into the small, validated
 * contract used by question generation. Ambiguous requests deliberately do
 * not receive an invented topic or an AI extraction call.
 */
export function extractTestIntent(message) {
  const rawMessage = String(message || '').trim()
  const hasRequestVerb = REQUEST_PATTERN.test(rawMessage)
  const hasTestNoun = TEST_NOUN_PATTERN.test(rawMessage)
  const countBeforeTestNoun = /\b(\d{1,2})\b(?=(?:\s+[a-z-]+){0,6}\s+(?:questions?|mcqs?|test|quiz)\b)/i.exec(rawMessage)
  const hasCountAndTestNoun = Boolean(countBeforeTestNoun)
  const looksLikeTestRequest = !REVIEW_PATTERN.test(rawMessage)
    && hasTestNoun
    && (hasRequestVerb || hasCountAndTestNoun)

  if (!looksLikeTestRequest) return { action: 'none' }

  const topic = extractTopic(rawMessage)
  if (!topic) {
    return {
      action: 'ambiguous',
      reason: 'मैं test बना सकता हूँ, बस topic clear नहीं हुआ। ऐसे लिखो: “DNS पर 20 conceptual questions बनाओ”.',
    }
  }

  const countMatch = countBeforeTestNoun
    || rawMessage.match(/\b(?:par|pe|pr|per|ke|ki|kay)\s+(\d{1,2})\b/i)

  return {
    action: 'generate_test',
    topic,
    questionCount: clampQuestionCount(Number(countMatch?.[1])),
    difficulty: extractDifficulty(rawMessage),
    questionType: extractQuestionType(rawMessage),
  }
}

export function buildGenerationDetails(intent) {
  const difficulty = intent?.difficulty === 'easy' || intent?.difficulty === 'medium' || intent?.difficulty === 'hard'
    ? intent.difficulty
    : 'mixed'
  const questionType = intent?.questionType === 'conceptual' ? 'conceptual' : 'multiple-choice'
  return `Difficulty: ${difficulty}. Question type: ${questionType}.`
}
