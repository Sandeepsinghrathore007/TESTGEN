import { normalizeStructuredExplanation } from '@/utils/explanationFormatting'

/**
 * testGeneration.js — Utilities for gathering content to generate AI tests.
 *
 * Functions:
 *  - gatherContentForTest: Collect notes/PDFs based on test scope
 *  - buildAIPrompt: Create prompt for AI test generation
 *  - parseAIResponse: Parse and validate AI-generated questions
 */

const OPTION_IDS = ['a', 'b', 'c', 'd']
const DEFAULT_PROMPT_OPTIONS = {
  maxNotes: 8,
  maxPdfs: 4,
  noteCharLimit: 1000,
  pdfCharLimit: 900,
  totalContextChars: 9000,
}

function truncateText(value, maxChars) {
  const text = String(value || '').replace(/\s+/g, ' ').trim()
  if (!text || !Number.isFinite(maxChars) || maxChars <= 0) return ''
  if (text.length <= maxChars) return text
  return `${text.slice(0, Math.max(0, maxChars - 1)).trimEnd()}...`
}

function clampPositiveInteger(value, fallback) {
  return Number.isInteger(value) && value > 0 ? value : fallback
}

/**
 * Strip HTML tags from content to get plain text.
 */
function stripHtml(html) {
  if (!html) return ''
  return String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6]|blockquote|tr|table)>/gi, '\n')
    .replace(/<\/(td|th)>/gi, ' | ')
    .replace(/<img\b[^>]*alt=["']([^"']+)["'][^>]*>/gi, ' [Image: $1] ')
    .replace(/<img\b[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\s*\|\s*(\n|$)/g, '$1')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

/**
 * Convert legacy note blocks into plain text.
 */
function blocksToText(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return ''

  return blocks
    .map((block) => {
      if (typeof block?.text !== 'string') return ''
      return block.text.trim()
    })
    .filter(Boolean)
    .join('\n')
}

/**
 * Get searchable plain text from a note.
 * Supports both TipTap HTML (`content`) and legacy block format (`blocks`).
 */
function getNotePlainText(note) {
  const htmlText = stripHtml(note?.content || '')
  if (htmlText) return htmlText
  return blocksToText(note?.blocks)
}

/**
 * Gather content from notes and PDFs based on test configuration.
 *
 * @param {Object} config - Test configuration
 * @param {Array} subjects - All subjects array
 * @returns {Object} - { notesContent, pdfContent, metadata }
 */
export function gatherContentForTest(config, subjects) {
  const { scope, subjectIds, topicIds } = config

  const notesContent = []
  const pdfContent = []
  const metadata = {
    subjects: [],
    topics: [],
    notes: [],
    selection: null,
  }

  if (scope === 'selection') {
    const selectedText = String(config.selectedText || '').trim()
    const selectionSource = config.selectionSource && typeof config.selectionSource === 'object'
      ? config.selectionSource
      : {}

    if (!selectedText) {
      return {
        notesContent,
        pdfContent,
        metadata,
      }
    }

    const selectedSubject = subjects.find((subject) =>
      subject.id === selectionSource.subjectId || subjectIds.includes(subject.id)
    )
    const selectedTopic = selectedSubject?.topics?.find((topic) =>
      topic.id === selectionSource.topicId || topicIds?.includes(topic.id)
    )
    const subjectId = selectedSubject?.id || selectionSource.subjectId || subjectIds[0] || null
    const subjectName = selectedSubject?.name || selectionSource.subjectName || 'Selected Subject'
    const topicId = selectedTopic?.id || selectionSource.topicId || topicIds?.[0] || null
    const topicName = selectedTopic?.name || selectionSource.topicName || 'Selected Topic'
    const noteTitle = String(selectionSource.noteTitle || 'Selected Note').trim() || 'Selected Note'

    metadata.subjects.push({
      id: subjectId,
      name: subjectName,
      color: selectedSubject?.color,
      icon: selectedSubject?.icon,
    })

    if (topicId || topicName) {
      metadata.topics.push({
        id: topicId,
        name: topicName,
        subjectId,
        subjectName,
      })
    }

    metadata.notes.push({
      id: selectionSource.noteId || null,
      title: noteTitle,
      topicId,
      topicName,
      subjectId,
      subjectName,
    })
    metadata.selection = {
      noteId: selectionSource.noteId || null,
      noteTitle,
      excerpt: truncateText(selectedText, 220),
    }

    notesContent.push({
      title: `${noteTitle} (Selected Text)`,
      content: selectedText,
      topicId,
      topicName,
      subjectId,
      subjectName,
    })

    return {
      notesContent,
      pdfContent,
      metadata,
    }
  }

  // Filter subjects based on scope
  const selectedSubjects = subjects.filter((s) => subjectIds.includes(s.id))

  selectedSubjects.forEach((subject) => {
    metadata.subjects.push({
      id: subject.id,
      name: subject.name,
      color: subject.color,
      icon: subject.icon,
    })

    // Determine which topics to include
    let topicsToInclude = subject.topics

    if (scope === 'topic' && topicIds && topicIds.length > 0) {
      // Only specific topics
      topicsToInclude = subject.topics.filter((t) => topicIds.includes(t.id))
    }

    topicsToInclude.forEach((topic) => {
      metadata.topics.push({
        id: topic.id,
        name: topic.name,
        subjectId: subject.id,
        subjectName: subject.name,
      })

      // Gather notes content
      topic.notes.forEach((note) => {
        const noteText = getNotePlainText(note)
        if (noteText) {
          notesContent.push({
            title: note.title,
            content: noteText,
            topicId: topic.id,
            topicName: topic.name,
            subjectId: subject.id,
            subjectName: subject.name,
          })
          metadata.notes.push({
            id: note.id,
            title: note.title,
            topicId: topic.id,
            topicName: topic.name,
            subjectId: subject.id,
            subjectName: subject.name,
          })
        }
      })
    })

    // Gather PDF content (summaries)
    if (subject.pdfs && subject.pdfs.length > 0) {
      subject.pdfs.forEach((pdf) => {
        if (pdf.summary) {
          pdfContent.push({
            title: pdf.title || pdf.name || 'Attached PDF',
            summary: pdf.summary,
            subjectId: subject.id,
            subjectName: subject.name,
          })
        }
      })
    }
  })

  return {
    notesContent,
    pdfContent,
    metadata,
  }
}

/**
 * Build AI prompt for Gemini API to generate test questions.
 *
 * @param {Object} config - Test configuration
 * @param {Object} content - Gathered content from gatherContentForTest
 * @returns {String} - Formatted prompt for AI
 */
export function buildAIPrompt(config, content, promptOptions = {}, generationOptions = {}) {
  const { questionCount, difficulty } = config
  const { notesContent, pdfContent, metadata } = content
  const normalizedQuestionLanguage = String(config?.language || 'hindi').trim().toLowerCase() === 'hindi'
    ? 'hindi'
    : 'english'
  const questionLanguageLabel = normalizedQuestionLanguage === 'hindi' ? 'Hindi (Devanagari)' : 'English'
  const questionLanguageInstruction = normalizedQuestionLanguage === 'hindi'
    ? 'Write every question and every option in Hindi using Devanagari script. Do not use Romanized Hindi.'
    : 'Write every question and every option in natural English.'
  const includeReviewFields = generationOptions?.includeReviewFields !== false
  const excludedQuestions = Array.isArray(generationOptions?.excludedQuestions)
    ? generationOptions.excludedQuestions
        .map((question) => truncateText(question, 180))
        .filter(Boolean)
    : []
  const chunkDescriptor = generationOptions?.chunkDescriptor && typeof generationOptions.chunkDescriptor === 'object'
    ? generationOptions.chunkDescriptor
    : null
  const options = {
    ...DEFAULT_PROMPT_OPTIONS,
    ...(promptOptions && typeof promptOptions === 'object' ? promptOptions : {}),
  }
  const maxNotes = clampPositiveInteger(options.maxNotes, DEFAULT_PROMPT_OPTIONS.maxNotes)
  const maxPdfs = clampPositiveInteger(options.maxPdfs, DEFAULT_PROMPT_OPTIONS.maxPdfs)
  const noteCharLimit = clampPositiveInteger(options.noteCharLimit, DEFAULT_PROMPT_OPTIONS.noteCharLimit)
  const pdfCharLimit = clampPositiveInteger(options.pdfCharLimit, DEFAULT_PROMPT_OPTIONS.pdfCharLimit)
  let remainingBudget = clampPositiveInteger(
    options.totalContextChars,
    DEFAULT_PROMPT_OPTIONS.totalContextChars
  )

  // Build context from notes
  let notesContext = ''
  if (notesContent.length > 0) {
    notesContext = 'NOTES CONTENT:\n\n'

    notesContent.slice(0, maxNotes).forEach((note, index) => {
      if (remainingBudget <= 0) return

      const noteHeader = `--- Note ${index + 1}: ${note.title} (${note.subjectName} - ${note.topicName}) ---\n`
      const availableChars = Math.max(180, remainingBudget - noteHeader.length)
      const trimmedContent = truncateText(note.content, Math.min(noteCharLimit, availableChars))
      if (!trimmedContent) return

      notesContext += `${noteHeader}${trimmedContent}\n\n`
      remainingBudget -= noteHeader.length + trimmedContent.length
    })
  }

  // Build context from PDFs
  let pdfContext = ''
  if (pdfContent.length > 0 && remainingBudget > 0) {
    pdfContext = 'PDF SUMMARIES:\n\n'

    pdfContent.slice(0, maxPdfs).forEach((pdf, index) => {
      if (remainingBudget <= 0) return

      const pdfHeader = `--- PDF ${index + 1}: ${pdf.title} (${pdf.subjectName}) ---\n`
      const availableChars = Math.max(140, remainingBudget - pdfHeader.length)
      const trimmedSummary = truncateText(pdf.summary, Math.min(pdfCharLimit, availableChars))
      if (!trimmedSummary) return

      pdfContext += `${pdfHeader}${trimmedSummary}\n\n`
      remainingBudget -= pdfHeader.length + trimmedSummary.length
    })
  }

  // Build subject/topic info
  const subjectNames = metadata.subjects.map((s) => s.name).join(', ')
  const topicNames = metadata.topics.map((t) => `${t.name} (${t.subjectName})`).join(', ')
  const selectionConstraint = config.scope === 'selection'
    ? 'IMPORTANT: The note content below is a user-selected excerpt from a larger note. Generate questions using only this selected excerpt and do not infer extra material beyond it.'
    : ''
  const chunkInstruction = chunkDescriptor
    ? `CHUNK INSTRUCTION:\nReturn exactly ${questionCount} NEW questions for items ${Number(chunkDescriptor.startIndex || 0) + 1}-${Math.min(Number(chunkDescriptor.totalQuestions || questionCount), Number(chunkDescriptor.startIndex || 0) + questionCount)} of ${Number(chunkDescriptor.totalQuestions || questionCount)}.`
    : ''
  const exclusionInstruction = excludedQuestions.length > 0
    ? `ALREADY GENERATED QUESTIONS (DO NOT REPEAT, REPHRASE, OR ASK THE SAME IDEA AGAIN):\n${excludedQuestions.map((question, index) => `${index + 1}. ${question}`).join('\n')}`
    : ''
  const questionOnlyExample = normalizedQuestionLanguage === 'hindi'
    ? `[
  {
    "question": "न्यूटन के प्रथम नियम के अनुसार विराम अवस्था में रखी वस्तु के बारे में क्या सही है?",
    "options": {
      "A": "वह तब तक विराम में रहेगी जब तक उस पर कोई नेट बल न लगाया जाए।",
      "B": "वह अपने आप चलने लगेगी।",
      "C": "वह हमेशा वृत्तीय पथ में चलेगी।",
      "D": "वह बिना बल के लगातार त्वरित होगी।"
    }
  }
]`
    : `[
  {
    "question": "What is the derivative of f(x) = x²?",
    "options": {
      "A": "2x",
      "B": "x",
      "C": "2",
      "D": "x²"
    }
  }
]`
  const fullReviewExample = normalizedQuestionLanguage === 'hindi'
    ? `[
  {
    "question": "गति का SI unit क्या है?",
    "options": {
      "A": "मीटर प्रति सेकंड",
      "B": "मीटर",
      "C": "सेकंड",
      "D": "न्यूटन"
    },
    "correctAnswer": "A",
    "explanation": "Concept:\\nयह question motion के basic unit concept पर based है।\\nVelocity या speed को distance divided by time से express किया जाता है, इसलिए इसका SI unit length aur time ke base units se बनता है।\\n\\nWhy Correct:\\nमीटर प्रति सेकंड सही है क्योंकि speed ya velocity का SI unit m/s होता है।\\n\\nOptions Breakdown:\\nA. मीटर प्रति सेकंड -> यही speed aur velocity का standard SI unit है\\nB. मीटर -> यह सिर्फ distance का unit है\\nC. सेकंड -> यह सिर्फ time का unit है\\nD. न्यूटन -> यह force का SI unit है\\n\\nExtra Knowledge:\\nAcceleration का SI unit मीटर प्रति सेकंड वर्ग होता है।\\nExam में speed aur velocity ka unit same hota hai, difference direction ka hota hai।"
  }
]`
    : `[
  {
    "question": "What is the derivative of f(x) = x²?",
    "options": {
      "A": "2x",
      "B": "x",
      "C": "2",
      "D": "x²"
    },
    "correctAnswer": "A",
    "explanation": "Concept:\\nयह question derivative के power rule पर based है।\\nPower rule में x^n का derivative n.x^(n-1) बनता है, यही core concept यहाँ apply होगा।\\n\\nWhy Correct:\\nx^2 पर rule लगाने से 2x मिलता है, इसलिए option A exact correct answer है।\\n\\nOptions Breakdown:\\nA. 2x -> power rule का सही result है\\nB. x -> exponent को properly use नहीं करता\\nC. 2 -> यह final derivative नहीं, सिर्फ coefficient part का confusion है\\nD. x^2 -> यह original function है, derivative नहीं\\n\\nExtra Knowledge:\\nPower rule polynomial differentiation का basic rule है।\\nNegative और fractional exponents पर भी यही logic apply होता है।"
  }
]`

  // Difficulty description
  let difficultyGuide = ''
  switch (difficulty) {
    case 'easy':
      difficultyGuide = 'Focus on basic definitions, fundamental concepts, and straightforward recall questions.'
      break
    case 'medium':
      difficultyGuide = 'Include application-based questions, problem-solving, and conceptual understanding.'
      break
    case 'hard':
      difficultyGuide = 'Create challenging questions requiring deep analysis, critical thinking, and complex problem-solving.'
      break
    case 'mixed':
      difficultyGuide = `Create a balanced mix: ${Math.ceil(questionCount * 0.3)} easy, ${Math.ceil(questionCount * 0.5)} medium, and ${Math.floor(questionCount * 0.2)} hard questions.`
      break
    default:
      difficultyGuide = 'Use a balanced mix of concept, application, and reasoning questions.'
      break
  }

  if (!includeReviewFields) {
    return `You are an expert competitive-exam educator creating a ${difficulty} difficulty test for a BCA 5th semester student preparing for RSSB Informatics Assistant.

SUBJECT(S): ${subjectNames}
TOPIC(S): ${topicNames}
${selectionConstraint}

${notesContext}

${pdfContext}

${chunkInstruction}

${exclusionInstruction}

TASK:
Generate exactly ${questionCount} multiple-choice questions based ONLY on the content provided above.
Prefer conceptual understanding, practical application, and exam-focused reasoning over rote definitions.
When the provided content supports it, shape questions like realistic RSSB Informatics Assistant practice.

DIFFICULTY LEVEL: ${difficulty}
${difficultyGuide}
QUESTION LANGUAGE: ${questionLanguageLabel}
${questionLanguageInstruction}

STRICT INSTRUCTION:
Return ONLY valid JSON.
Do NOT include any extra text, explanation, markdown, or comments outside JSON.
Do NOT wrap JSON in backticks.

REQUIREMENTS:
1. Each question MUST have exactly 4 options labeled A, B, C, D.
2. Questions should test understanding, application, and critical thinking.
3. Include variety: definitions, calculations, applications, analysis.
4. Make incorrect options strong exam-style distractors: plausible, conceptually close, but clearly wrong.
5. Base ALL questions on the actual content provided - do not add external information.
6. Write the question text and all option text in ${questionLanguageLabel}.
7. The output for each question must have:
   - question: string
   - options: object with exactly 4 keys "A", "B", "C", "D"
8. Do NOT include correctAnswer.
9. Do NOT include explanation.

OUTPUT FORMAT (Strict JSON):
Return ONLY a valid JSON array with this exact structure:

${questionOnlyExample}

CRITICAL: Return ONLY the JSON array, no additional text, no markdown formatting, no code blocks.`
  }

  return `You are an expert competitive-exam educator creating a ${difficulty} difficulty test for a BCA 5th semester student preparing for RSSB Informatics Assistant.

SUBJECT(S): ${subjectNames}
TOPIC(S): ${topicNames}
${selectionConstraint}

${notesContext}

${pdfContext}

${chunkInstruction}

${exclusionInstruction}

TASK:
Generate exactly ${questionCount} multiple-choice questions based ONLY on the content provided above.
Prefer conceptual understanding, practical application, and exam-focused reasoning over rote definitions.
When the provided content supports it, shape questions like realistic RSSB Informatics Assistant practice.

DIFFICULTY LEVEL: ${difficulty}
${difficultyGuide}
QUESTION LANGUAGE: ${questionLanguageLabel}
${questionLanguageInstruction}

STRICT INSTRUCTION:
Return ONLY valid JSON.
Do NOT include any extra text, explanation, markdown, or comments outside JSON.
Do NOT wrap JSON in backticks.
Use escaped \\n inside explanation strings for every line break. Never place raw line breaks inside a JSON string value.

REQUIREMENTS:
1. Each question MUST have exactly 4 options labeled A, B, C, D.
2. Only ONE option should be correct.
3. Questions should test understanding, application, and critical thinking.
4. Include variety: definitions, calculations, applications, analysis.
5. Make incorrect options strong exam-style distractors: plausible, conceptually close, but clearly wrong.
6. Generate question, options, correctAnswer, and explanation in ONE API response.
7. Write the question text and all option text in ${questionLanguageLabel}.
8. The output for each question must have:
   - question: string
   - options: object with exactly 4 keys "A", "B", "C", "D"
   - correctAnswer: uppercase "A", "B", "C", or "D"
   - explanation: structured Devanagari Hinglish string
9. Generate explanation in STRICT structured format using Hinglish style written in Hindi (Devanagari script).
10. Explanation should build deep understanding, help revision, and improve future question solving.
11. Explanation length should usually be 5 to 10 readable lines.
12. Explanation must use these exact headings with explicit \\n line breaks:
   - Concept:
   - Why Correct:
   - Options Breakdown:
   - Extra Knowledge:
13. Under Concept, explain the core concept in 2 to 3 lines in simple Devanagari Hinglish.
14. Under Why Correct, explain clearly why the correct option fits.
15. Under Options Breakdown, write EACH option on a NEW LINE using A., B., C., D.
16. Under Options Breakdown, explain each option based on the question context. If topic is river, explain all options as rivers. If topic is king, explain all options as kings. If topic is polity, explain them conceptually within polity context.
17. For wrong options, include what that option actually represents and the important exam-related fact linked to it.
18. Under Extra Knowledge, add 1 or 2 useful facts, shortcuts, exceptions, or memory hooks related to the topic.
19. Do NOT write generic lines. Do NOT merge everything into one paragraph.
20. Use Hindi script (Devanagari) for the explanation body.
21. Use a simple conversational teacher tone.
22. Common English words like option, concept, rule, formula, logic, process, law, method are allowed when they fit naturally.
23. Avoid pure English sentences. Avoid overly formal Hindi.
24. Base ALL questions on the actual content provided - do not add external information.

OUTPUT FORMAT (Strict JSON):
Return ONLY a valid JSON array with this exact structure:

${fullReviewExample}

CRITICAL: Return ONLY the JSON array, no additional text, no markdown formatting, no code blocks.`
}

export function buildAIFullReviewPrompt(config, content, promptOptions = {}, generationOptions = {}) {
  return buildAIPrompt(config, content, promptOptions, {
    ...generationOptions,
    includeReviewFields: true,
  })
}

export function buildAIQuestionOnlyPrompt(config, content, promptOptions = {}, generationOptions = {}) {
  return buildAIPrompt(config, content, promptOptions, {
    ...generationOptions,
    includeReviewFields: false,
  })
}

function tryParseJson(rawText) {
  try {
    return JSON.parse(rawText)
  } catch {
    return null
  }
}

function sanitizeAiResponseText(rawText) {
  return String(rawText || '')
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/i, '')
    .replace(/^`+/, '')
    .replace(/`+$/, '')
    .trim()
}

function escapeInvalidJsonStringCharacters(rawText) {
  const text = String(rawText || '')
  if (!text) return text

  let result = ''
  let inString = false
  let isEscaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (!inString) {
      if (char === '"') {
        inString = true
      }
      result += char
      continue
    }

    if (isEscaped) {
      result += char
      isEscaped = false
      continue
    }

    if (char === '\\') {
      result += char
      isEscaped = true
      continue
    }

    if (char === '"') {
      inString = false
      result += char
      continue
    }

    if (char === '\r') {
      if (text[index + 1] === '\n') {
        index += 1
      }
      result += '\\n'
      continue
    }

    if (char === '\n') {
      result += '\\n'
      continue
    }

    if (char === '\t') {
      result += '\\t'
      continue
    }

    result += char
  }

  return result
}

function repairJsonText(rawText) {
  let repaired = String(rawText || '').trim()
  if (!repaired) return repaired

  // Normalize smart quotes.
  repaired = repaired
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")

  // Replace JS-style literals with JSON-safe values.
  repaired = repaired
    .replace(/\bundefined\b/g, 'null')
    .replace(/\bNaN\b/g, 'null')
    .replace(/\bTrue\b/g, 'true')
    .replace(/\bFalse\b/g, 'false')
    .replace(/\bNone\b/g, 'null')

  // Quote unquoted object keys: { question: ... } -> { "question": ... }
  repaired = repaired.replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_\- ]*)(\s*:)/g, (_, start, key, end) => {
    const safeKey = key.trim().replace(/"/g, '\\"')
    return `${start}"${safeKey}"${end}`
  })

  // Convert single-quoted strings to double-quoted strings.
  repaired = repaired.replace(/'([^'\\]*(?:\\.[^'\\]*)*)'/g, (_, inner) => {
    const unescaped = inner.replace(/\\'/g, "'")
    return JSON.stringify(unescaped)
  })

  // Remove trailing commas before } or ]
  repaired = repaired.replace(/,\s*([}\]])/g, '$1')

  repaired = escapeInvalidJsonStringCharacters(repaired)

  return repaired
}

function extractJsonString(rawText) {
  const trimmed = sanitizeAiResponseText(rawText)
  if (!trimmed) return ''

  if (tryParseJson(trimmed) !== null) {
    return trimmed
  }

  // Try extracting JSON array first.
  const firstArrayStart = trimmed.indexOf('[')
  const lastArrayEnd = trimmed.lastIndexOf(']')
  if (firstArrayStart !== -1 && lastArrayEnd > firstArrayStart) {
    return trimmed.slice(firstArrayStart, lastArrayEnd + 1).trim()
  }

  // Try extracting JSON object wrapper.
  const firstObjectStart = trimmed.indexOf('{')
  const lastObjectEnd = trimmed.lastIndexOf('}')
  if (firstObjectStart !== -1 && lastObjectEnd > firstObjectStart) {
    return trimmed.slice(firstObjectStart, lastObjectEnd + 1).trim()
  }

  return trimmed
}

// Extract complete top-level JSON values without guessing or repairing.
// This avoids accepting partial streamed output while still tolerating small
// wrapper text before the actual JSON payload.
function extractCompleteJsonValues(rawText) {
  const text = sanitizeAiResponseText(rawText)
  const values = []

  for (let start = 0; start < text.length; start += 1) {
    const opening = text[start]
    if (opening !== '{' && opening !== '[') continue

    const stack = [opening]
    let inString = false
    let escaped = false

    for (let index = start + 1; index < text.length; index += 1) {
      const char = text[index]
      if (inString) {
        if (escaped) escaped = false
        else if (char === '\\') escaped = true
        else if (char === '"') inString = false
        continue
      }

      if (char === '"') {
        inString = true
      } else if (char === '{' || char === '[') {
        stack.push(char)
      } else if (char === '}' || char === ']') {
        const lastOpening = stack[stack.length - 1]
        const expectedClosing = lastOpening === '{' ? '}' : ']'
        if (char !== expectedClosing) break
        stack.pop()
        if (stack.length === 0) {
          values.push(text.slice(start, index + 1))
          break
        }
      }
    }
  }

  return Array.from(new Set(values))
}

function extractTopLevelObjectStrings(rawText) {
  const text = sanitizeAiResponseText(rawText)
  if (!text) return []

  const objects = []
  let startIndex = -1
  let depth = 0
  let inString = false
  let isEscaped = false

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index]

    if (inString) {
      if (isEscaped) {
        isEscaped = false
        continue
      }

      if (char === '\\') {
        isEscaped = true
        continue
      }

      if (char === '"') {
        inString = false
      }

      continue
    }

    if (char === '"') {
      inString = true
      continue
    }

    if (char === '{') {
      if (depth === 0) {
        startIndex = index
      }
      depth += 1
      continue
    }

    if (char === '}') {
      if (depth === 0) continue

      depth -= 1
      if (depth === 0 && startIndex !== -1) {
        objects.push(text.slice(startIndex, index + 1))
        startIndex = -1
      }
    }
  }

  return objects
}

function extractRecoveredQuestionsPayload(rawText) {
  const objectStrings = extractTopLevelObjectStrings(rawText)
  if (objectStrings.length === 0) {
    return null
  }

  const arrayCandidate = `[${objectStrings.join(',')}]`
  return tryParseJson(arrayCandidate)
}

function extractQuestionsArray(parsedPayload) {
  if (Array.isArray(parsedPayload)) return parsedPayload
  if (Array.isArray(parsedPayload?.questions)) return parsedPayload.questions
  if (Array.isArray(parsedPayload?.data?.questions)) return parsedPayload.data.questions
  throw new Error('Response JSON does not contain a questions array')
}

function normalizeDifficulty(value) {
  const normalized = String(value || '').trim().toLowerCase()
  if (normalized === 'easy' || normalized === 'medium' || normalized === 'hard') {
    return normalized
  }
  return 'medium'
}

function normalizeOptionText(option) {
  if (typeof option === 'string') return option.trim()
  if (typeof option?.text === 'string') return option.text.trim()
  return ''
}

function normalizeOptionsFromObject(optionsObject) {
  if (!optionsObject || typeof optionsObject !== 'object' || Array.isArray(optionsObject)) {
    return []
  }

  const texts = OPTION_IDS.map((id, index) => {
    const upper = id.toUpperCase()
    return normalizeOptionText(
      optionsObject[id]
      ?? optionsObject[upper]
      ?? optionsObject[`option${upper}`]
      ?? optionsObject[`option_${id}`]
      ?? optionsObject[String(index + 1)]
    )
  })

  if (texts.some((text) => !text)) return []

  return texts.map((text, index) => ({
    id: OPTION_IDS[index],
    text,
  }))
}

function normalizeOptionsFromString(optionsText) {
  if (typeof optionsText !== 'string') return []

  const lines = optionsText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (lines.length === 0) return []

  const optionsById = {}
  lines.forEach((line) => {
    const match = line.match(/^[\-\*\d\.\)\s]*([A-Da-d])[)\].:\-]\s*(.+)$/)
    if (!match) return
    const id = match[1].toLowerCase()
    optionsById[id] = match[2].trim()
  })

  if (OPTION_IDS.some((id) => !optionsById[id])) return []

  return OPTION_IDS.map((id) => ({
    id,
    text: optionsById[id],
  }))
}

function normalizeOptionsFromLegacyFields(question) {
  const texts = OPTION_IDS.map((id) => {
    const upper = id.toUpperCase()
    return normalizeOptionText(
      question?.[`option${upper}`]
      ?? question?.[`option_${id}`]
      ?? question?.[`option_${upper}`]
    )
  })

  if (texts.some((text) => !text)) return []

  return texts.map((text, index) => ({
    id: OPTION_IDS[index],
    text,
  }))
}

function getNormalizedOptions(question, questionIndex) {
  // Preferred: options array
  if (Array.isArray(question?.options) && question.options.length >= 4) {
    return question.options.slice(0, 4).map((option, optionIndex) => {
      const text = normalizeOptionText(option)
      if (!text) {
        throw new Error(`Question ${questionIndex + 1}, option ${optionIndex + 1} missing text`)
      }
      return {
        id: OPTION_IDS[optionIndex],
        text,
      }
    })
  }

  // options object map
  const fromObject = normalizeOptionsFromObject(question?.options)
  if (fromObject.length === 4) return fromObject

  // options plain string block
  const fromString = normalizeOptionsFromString(question?.options)
  if (fromString.length === 4) return fromString

  // optionA/optionB/... legacy fields
  const fromLegacyFields = normalizeOptionsFromLegacyFields(question)
  if (fromLegacyFields.length === 4) return fromLegacyFields

  throw new Error(`Question ${questionIndex + 1} must include 4 valid options`)
}

function resolveCorrectIndex(correctAnswer, options) {
  if (typeof correctAnswer === 'number' && Number.isInteger(correctAnswer)) {
    return correctAnswer >= 0 && correctAnswer < 4 ? correctAnswer : -1
  }

  const raw = String(correctAnswer || '').trim().toLowerCase()
  if (!raw) return -1

  // Supports "a", "A", "option a", "a)", "(a)".
  const letterMatch = raw.match(/[a-d]/)
  if (letterMatch) {
    const index = OPTION_IDS.indexOf(letterMatch[0])
    if (index !== -1) return index
  }

  // Supports exact option text as correctAnswer.
  const textIndex = options.findIndex((opt) => opt.text.trim().toLowerCase() === raw)
  if (textIndex !== -1) return textIndex

  return -1
}

/**
 * Parse and validate AI response from Gemini.
 *
 * @param {String} responseText - Raw response from Gemini API
 * @returns {Array} - Validated array of questions
 */
export function parseAIResponse(
  responseText,
  { fallbackDifficulty = 'medium', expectReviewFields = true, expectedQuestionCount = null } = {}
) {
  try {
    const parseCandidates = [
      ...extractCompleteJsonValues(responseText),
      extractJsonString(responseText),
    ].filter(Boolean)
    const uniqueCandidates = Array.from(new Set(parseCandidates))
    let parsedPayload = null

    for (const candidate of uniqueCandidates) {
      parsedPayload = tryParseJson(candidate)
      if (parsedPayload !== null) {
        break
      }
    }

    if (parsedPayload === null) {
      console.error('AI test raw response (invalid JSON):', responseText)
      console.error('AI test extracted JSON candidates:', uniqueCandidates)
      throw new Error('AI returned malformed JSON. No test was created; please try again.')
    }

    const questions = extractQuestionsArray(parsedPayload)

    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error('Response does not contain questions')
    }

    if (Number.isInteger(expectedQuestionCount) && questions.length !== expectedQuestionCount) {
      throw new Error(`AI returned ${questions.length} questions, but ${expectedQuestionCount} were requested`)
    }

    const validated = questions.map((question, index) => {
      if (!question?.question || typeof question.question !== 'string') {
        throw new Error(`Question ${index + 1} missing or invalid question text`)
      }
      const normalizedOptions = getNormalizedOptions(question, index)
      const baseQuestion = {
        question: question.question.trim(),
        options: normalizedOptions,
        difficulty: normalizeDifficulty(question.difficulty || fallbackDifficulty),
        ...(typeof question.subjectName === 'string' && question.subjectName.trim()
          ? { subjectName: question.subjectName.trim() }
          : {}),
        ...(typeof question.topicName === 'string' && question.topicName.trim()
          ? { topicName: question.topicName.trim() }
          : {}),
        ...(typeof question.sourceQuestion === 'string' && question.sourceQuestion.trim()
          ? { sourceQuestion: question.sourceQuestion.trim() }
          : {}),
      }

      if (!expectReviewFields) {
        return baseQuestion
      }

      if (!question?.explanation || typeof question.explanation !== 'string') {
        throw new Error(`Question ${index + 1} missing explanation`)
      }

      const correctIndex = resolveCorrectIndex(question.correctAnswer, normalizedOptions)
      if (correctIndex === -1) {
        throw new Error(`Question ${index + 1} has invalid correctAnswer`)
      }

      const normalizedExplanation = normalizeStructuredExplanation(question.explanation)

      return {
        ...baseQuestion,
        correctAnswer: OPTION_IDS[correctIndex],
        explanation: normalizedExplanation,
      }
    })

    return validated
  } catch (error) {
    console.error('Failed to parse AI response:', error)
    if (String(error?.message || '').toLowerCase().includes('invalid json')) {
      throw error
    }
    throw new Error(`Failed to parse AI-generated questions: ${error.message}`)
  }
}

export function parseAIQuestionOnlyResponse(responseText, options = {}) {
  return parseAIResponse(responseText, {
    ...options,
    expectReviewFields: false,
  })
}
