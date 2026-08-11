/**
 * aiService.js — Real AI service layer communicating with local OmniRoute gateway.
 *
 * Base URL: http://localhost:20128/v1
 * Endpoint: /chat/completions
 * Supports Models list and real streaming.
 */

import { uid } from '@/utils/id'
import { parseAIResponse } from '@/utils/testGeneration'
import { buildGenerationDetails, extractTestIntent } from '@/utils/testIntent'
import { OFFLINE_TEST_SCHEMA } from '@/utils/offlineTestImport'

const OMNIROUTE_URL = 'http://localhost:20128/v1/chat/completions'
const MODELS_URL = 'http://localhost:20128/v1/models'
const DEFAULT_MODEL = 'auto/best-free'
const STRUCTURED_TEST_MODEL = 'auto/best-free'
const OMNIROUTE_TIMEOUT_MS = 60_000
const MODEL_ROUTE_CHECK_TIMEOUT_MS = 20_000
const MODEL_ROUTE_CHECK_CACHE_TTL = 5 * 60 * 1000

let _modelsCache = null
let _modelMetadataCache = null
let _modelsCacheTime = 0
const _modelRouteCheckCache = new Map()
const MODELS_CACHE_TTL = 5 * 60 * 1000 // 5 minutes

const OMNIROUTE_MULTIMODAL_ROUTES = new Set([
  'auto/best-vision',
  'auto/pro-vision',
  'auto/vision',
  'auto/multimodal',
  'auto/gemini',
])

function normalizeModelList(data) {
  if (data && Array.isArray(data.data)) return data.data
  if (Array.isArray(data)) return data
  return []
}

function readCapability(source, keys) {
  if (!source || typeof source !== 'object') return undefined

  for (const key of keys) {
    const matchingKey = Object.keys(source).find((candidate) => candidate.toLowerCase() === key.toLowerCase())
    if (!matchingKey) continue

    const value = source[matchingKey]
    if (typeof value === 'boolean') return value
    if (Array.isArray(value)) return value.length > 0
    if (typeof value === 'string') return /true|supported|image|vision|document|pdf|file/i.test(value)
  }

  const modalities = source.input_modalities || source.inputModalities || source.modalities || source.input_types
  if (Array.isArray(modalities)) {
    const normalized = modalities.map((item) => String(item).toLowerCase())
    if (keys.some((key) => /image|vision/i.test(key))) {
      return normalized.some((item) => /image|vision/.test(item))
    }
    return normalized.some((item) => /pdf|document|file/.test(item))
  }

  return undefined
}

function getModelInputCapabilities(model) {
  const id = String(model?.id || '').toLowerCase()
  const capabilities = model?.capabilities || {}
  const imageKeys = ['image_input', 'imageInput', 'images', 'image', 'vision', 'supports_images', 'supportsImages']
  const documentKeys = ['pdf', 'pdf_input', 'document', 'documents', 'file_input', 'fileInput', 'files', 'supports_files', 'supportsFiles']
  const explicitImage = readCapability(capabilities, imageKeys) ?? readCapability(model, imageKeys)
  const explicitDocument = readCapability(capabilities, documentKeys) ?? readCapability(model, documentKeys)

  if (explicitImage !== undefined || explicitDocument !== undefined) {
    return {
      image: explicitImage,
      document: explicitDocument,
      source: 'model metadata',
    }
  }

  // OmniRoute exposes these as dedicated routing models even when its model list
  // omits input modality flags. These routes are intentionally multimodal.
  if (OMNIROUTE_MULTIMODAL_ROUTES.has(id)) {
    return { image: true, document: true, source: 'OmniRoute vision route' }
  }

  // Missing metadata is not evidence that a provider cannot accept a file.
  // For example, OmniRoute currently lists aug/opus4.6-500k without modality
  // fields even though its upstream route can change independently.
  return { image: undefined, document: undefined, source: 'unknown' }
}

function buildUserContent(text, attachment) {
  const prompt = String(text || '').trim() || `Please analyze the attached ${attachment?.kind === 'image' ? 'image' : 'file'}.`
  if (!attachment?.requestPart && !attachment?.contextText) return prompt

  const content = [{ type: 'text', text: prompt }]

  // PDF/document routes are inconsistent across providers. Keep the original
  // binary part, but include locally extracted text as a reliable fallback.
  // This means a routed text-only provider still receives the document's actual
  // contents instead of only a filename.
  if (attachment?.contextText) {
    content.push({
      type: 'text',
      text: `Extracted content from attached ${attachment.filename || 'document'}:\n${attachment.contextText}`,
    })
  }

  if (attachment?.requestPart) content.push(attachment.requestPart)

  return content
}

function getAttachmentLogDetails(attachment) {
  if (!attachment) return { attached: false }

  return {
    attached: true,
    kind: attachment.kind,
    mimeType: attachment.mimeType,
    filename: attachment.filename,
    size: attachment.size,
    hasRequestPart: Boolean(attachment.requestPart),
    hasExtractedText: Boolean(attachment.contextText),
    contextWarning: attachment.contextWarning || null,
  }
}

function getStructuredTestModelConfig(config = {}, attachment = null) {
  const requestedModel = String(config?.model || DEFAULT_MODEL).trim() || DEFAULT_MODEL

  // Vision/multimodal routes are useful when the user attaches an image/PDF, but
  // they are unreliable for text-only strict JSON generation in OmniRoute.
  // Keep normal chat model selection untouched; only structured test generation
  // gets routed to the safer text model when no attachment is present.
  if (!attachment && OMNIROUTE_MULTIMODAL_ROUTES.has(requestedModel.toLowerCase())) {
    return {
      ...config,
      model: STRUCTURED_TEST_MODEL,
      routedFromModel: requestedModel,
    }
  }

  return {
    ...config,
    model: requestedModel,
  }
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 15000) {
  const controller = new AbortController()
  const timerApi = typeof window !== 'undefined' ? window : globalThis;
  const timeoutId = timerApi.setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`)
    }
    throw error
  } finally {
    timerApi.clearTimeout(timeoutId)
  }
}

/**
 * Fetch available models from OmniRoute
 */
export async function getAvailableModelMetadata() {
  if (_modelMetadataCache && (Date.now() - _modelsCacheTime) < MODELS_CACHE_TTL) {
    return _modelMetadataCache
  }

  try {
    const response = await fetchWithTimeout(MODELS_URL, {}, 10000)
    if (!response.ok) throw new Error('Network response was not ok')
    const data = await response.json()

    const fetchedModels = normalizeModelList(data)
      .map((model) => (typeof model === 'string' ? { id: model } : model))
      .filter((model) => model?.id)
    const uniqueModels = new Map([[DEFAULT_MODEL, { id: DEFAULT_MODEL }]])
    fetchedModels.forEach((model) => uniqueModels.set(model.id, model))

    _modelMetadataCache = Array.from(uniqueModels.values()).map((model) => ({
      ...model,
      inputCapabilities: getModelInputCapabilities(model),
    }))
    _modelsCache = _modelMetadataCache.map((model) => model.id)
    _modelsCacheTime = Date.now()
    return _modelMetadataCache
  } catch (err) {
    console.warn('Failed to fetch models from OmniRoute, falling back to default', err)
    _modelsCache = [DEFAULT_MODEL]
    _modelMetadataCache = [{
      id: DEFAULT_MODEL,
      inputCapabilities: getModelInputCapabilities({ id: DEFAULT_MODEL }),
    }]
    _modelsCacheTime = Date.now()
    return _modelMetadataCache
  }
}

export async function getAvailableModels() {
  const models = await getAvailableModelMetadata()
  return models.map((model) => model.id)
}

export async function getModelAttachmentSupport(modelId, kind) {
  const models = await getAvailableModelMetadata()
  const model = models.find((item) => item.id === modelId) || { id: modelId }
  const capabilities = model.inputCapabilities || getModelInputCapabilities(model)
  const capability = kind === 'image' ? capabilities.image : capabilities.document

  return {
    // Only an explicit `false` blocks a request. Unknown metadata must not turn
    // into a false negative that prevents OmniRoute from trying the provider.
    supported: capability !== false,
    certainty: capability === true ? 'supported' : capability === false ? 'unsupported' : 'unknown',
    capabilities,
    model,
  }
}

export async function getCompatibleAttachmentModels(kind) {
  const models = await getAvailableModelMetadata()
  const confirmedModels = models
    .filter((model) => kind === 'image'
      ? model.inputCapabilities?.image === true
      : model.inputCapabilities?.document === true)
    .map((model) => model.id)

  const preferredRoutes = Array.from(OMNIROUTE_MULTIMODAL_ROUTES)
    .filter((modelId) => models.some((model) => model.id === modelId))

  return Array.from(new Set([...preferredRoutes, ...confirmedModels]))
}

export async function repairOfflineTestJsonWithAI(rawContent, validationError, config = {}) {
  let jsonText = String(rawContent || '').trim()
  
  // Clean fences and find bracket boundaries to extract clean raw JSON
  const firstBrace = jsonText.indexOf('{')
  const lastBrace = jsonText.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonText = jsonText.substring(firstBrace, lastBrace + 1)
  } else {
    jsonText = jsonText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim()
  }

  if (!jsonText) {
    throw new Error('No JSON content was extracted for AI repair.')
  }

  // Parse error position from the message
  const errMsg = String(validationError || '')
  let pos = -1
  const positionMatch = errMsg.match(/at position (\d+)/i)
  if (positionMatch) {
    pos = parseInt(positionMatch[1], 10)
  } else {
    const lineColMatch = errMsg.match(/at line (\d+) column (\d+)/i)
    if (lineColMatch) {
      const targetLine = parseInt(lineColMatch[1], 10)
      const targetCol = parseInt(lineColMatch[2], 10)
      const lines = jsonText.split('\n')
      let computedPos = 0
      for (let i = 0; i < Math.min(targetLine - 1, lines.length); i++) {
        computedPos += lines[i].length + 1
      }
      computedPos += targetCol - 1
      pos = computedPos
    }
  }

  // Fallback if no position was detected or error is at the end
  if (pos === -1 || errMsg.toLowerCase().includes('end of json') || errMsg.toLowerCase().includes('end of input')) {
    pos = jsonText.length
  }

  // Slice context window around error position
  const CONTEXT_WINDOW = 250
  const start = Math.max(0, pos - CONTEXT_WINDOW)
  const end = Math.min(jsonText.length, pos + CONTEXT_WINDOW)
  const originalSnippet = jsonText.substring(start, end)
  
  const markedSnippet = jsonText.substring(start, pos) + " >>> ERROR HERE <<< " + jsonText.substring(pos, end)

  const messages = [
    {
      role: 'system',
      content: [
        'You are a precise JSON syntax corrector.',
        'Your task is to fix a syntax error in a snippet of a JSON file.',
        'You will be given the snippet containing the error marked with " >>> ERROR HERE <<< ".',
        'Correct the syntax error (such as missing commas, unescaped quotes, trailing commas, mismatched brackets, or bad escapes) around the marker.',
        'Return ONLY the corrected snippet. Do not include the marker " >>> ERROR HERE <<< " in your output.',
        'Keep all other characters, questions, options, and text in the snippet exactly the same.',
        'Do not include markdown code fences, comments, or any conversational text. Return only the corrected JSON snippet text.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: [
        `Validation error: ${errMsg}`,
        '',
        'Correct the syntax error in the following snippet:',
        markedSnippet,
      ].join('\n'),
    },
  ]

  // Invoke OmniRoute without forced json_object format since it is a snippet
  const repairedSnippetRaw = await callOmniRoute(messages, null, {
    model: config.model || DEFAULT_MODEL,
    thinking: config.thinking,
  })

  // Clean the snippet (remove outer formatting/code fences)
  const repairedSnippet = String(repairedSnippetRaw || '')
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const repairedFullJson = jsonText.substring(0, start) + repairedSnippet + jsonText.substring(end)
  
  // Validate complete repaired JSON locally
  try {
    JSON.parse(repairedFullJson)
    return repairedFullJson
  } catch (err) {
    throw new Error(`AI repaired snippet but complete JSON still invalid: ${err.message}. Repaired snippet received: "${repairedSnippet.slice(0, 100)}..."`)
  }
}

export const supportsThinking = (modelId) => {
  if (!modelId) return false
  const m = String(modelId).toLowerCase()
  return m.includes('o1') || m.includes('o3') || m.includes('r1') || m.includes('thinking') || m.includes('reasoning') || m.includes('pro')
}

function getTimerApi() {
  return typeof window !== 'undefined' ? window : globalThis
}

function parseOmniRouteErrorBody(rawText) {
  const raw = String(rawText || '').trim()
  if (!raw) return { message: '', code: '', type: '', raw: '' }

  try {
    const parsed = JSON.parse(raw)
    return {
      message: parsed?.error?.message || parsed?.message || raw,
      code: parsed?.error?.code || parsed?.code || '',
      type: parsed?.error?.type || parsed?.type || '',
      raw,
    }
  } catch {
    return { message: raw, code: '', type: '', raw }
  }
}

function createModelUnavailableError(modelId, reason, details = {}) {
  const error = new Error(`The selected model "${modelId}" is not routable in the current OmniRoute setup. ${reason} Choose an auto/* route or configure the required provider/backend.`)
  error.code = 'MODEL_UNAVAILABLE'
  error.model = modelId
  error.details = details
  return error
}

export function isOmniRouteModelUnavailableError(error) {
  return error?.code === 'MODEL_UNAVAILABLE'
}

function createOmniRouteStatusError(status, rawText) {
  const parsed = parseOmniRouteErrorBody(rawText)
  const message = parsed.message || 'Unknown error'
  const error = new Error(`API returned status ${status}: ${message}`)
  error.status = status
  error.omniroute = parsed
  return error
}

function shouldVerifyDirectModel(modelId) {
  const normalized = String(modelId || '').trim().toLowerCase()
  return normalized && !normalized.startsWith('auto/')
}

async function assertModelRoutable(modelId) {
  const normalizedModel = String(modelId || DEFAULT_MODEL).trim() || DEFAULT_MODEL
  if (!shouldVerifyDirectModel(normalizedModel)) return

  const cached = _modelRouteCheckCache.get(normalizedModel)
  if (cached && (Date.now() - cached.checkedAt) < MODEL_ROUTE_CHECK_CACHE_TTL) {
    if (cached.ok) return
    throw createModelUnavailableError(normalizedModel, cached.reason, cached.details)
  }

  const models = await getAvailableModelMetadata()
  const metadata = models.find((model) => model.id === normalizedModel)
  if (!metadata) {
    const reason = 'OmniRoute /v1/models does not list this exact model ID.'
    _modelRouteCheckCache.set(normalizedModel, {
      ok: false,
      checkedAt: Date.now(),
      reason,
      details: { source: 'models-list' },
    })
    throw createModelUnavailableError(normalizedModel, reason, { source: 'models-list' })
  }

  const probeBody = {
    model: normalizedModel,
    messages: [{ role: 'user', content: 'Reply with exactly: ok' }],
    stream: false,
    max_tokens: 4,
  }

  try {
    const response = await fetchOmniRoute(probeBody, { timeoutMs: MODEL_ROUTE_CHECK_TIMEOUT_MS })
    const responseText = await readOmniRouteBody(response.text(), MODEL_ROUTE_CHECK_TIMEOUT_MS)

    if (!response.ok) {
      const parsed = parseOmniRouteErrorBody(responseText)
      const reason = parsed.message || `Provider returned HTTP ${response.status}.`
      _modelRouteCheckCache.set(normalizedModel, {
        ok: false,
        checkedAt: Date.now(),
        reason,
        details: { status: response.status, ...parsed, ownedBy: metadata.owned_by },
      })
      throw createModelUnavailableError(normalizedModel, reason, { status: response.status, ...parsed, ownedBy: metadata.owned_by })
    }

    let parsed
    try {
      parsed = JSON.parse(responseText)
    } catch {
      const reason = 'The provider probe returned a non-JSON response.'
      _modelRouteCheckCache.set(normalizedModel, {
        ok: false,
        checkedAt: Date.now(),
        reason,
        details: { ownedBy: metadata.owned_by, raw: responseText.slice(0, 500) },
      })
      throw createModelUnavailableError(normalizedModel, reason, { ownedBy: metadata.owned_by })
    }

    const content = parsed?.choices?.[0]?.message?.content
    if (!content) {
      const reason = 'The provider probe completed but returned no assistant content.'
      _modelRouteCheckCache.set(normalizedModel, {
        ok: false,
        checkedAt: Date.now(),
        reason,
        details: { ownedBy: metadata.owned_by },
      })
      throw createModelUnavailableError(normalizedModel, reason, { ownedBy: metadata.owned_by })
    }

    _modelRouteCheckCache.set(normalizedModel, {
      ok: true,
      checkedAt: Date.now(),
      details: { ownedBy: metadata.owned_by },
    })
  } catch (error) {
    if (isOmniRouteModelUnavailableError(error)) throw error
    if (error?.name === 'AbortError' || error?.message?.includes('timed out')) {
      const reason = `OmniRoute could not verify this direct provider route within ${MODEL_ROUTE_CHECK_TIMEOUT_MS / 1000} seconds.`
      _modelRouteCheckCache.set(normalizedModel, {
        ok: false,
        checkedAt: Date.now(),
        reason,
        details: { ownedBy: metadata.owned_by },
      })
      throw createModelUnavailableError(normalizedModel, reason, { ownedBy: metadata.owned_by })
    }
    throw error
  }
}

async function fetchOmniRoute(body, { timeoutMs = OMNIROUTE_TIMEOUT_MS } = {}) {
  const controller = new AbortController()
  const timerApi = getTimerApi()
  const timeoutId = timerApi.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(OMNIROUTE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`OmniRoute timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again or choose another model.`)
    }
    throw error
  } finally {
    timerApi.clearTimeout(timeoutId)
  }
}

async function readOmniRouteBody(promise, timeoutMs = OMNIROUTE_TIMEOUT_MS) {
  let timeoutId
  const timerApi = getTimerApi()

  try {
    return await Promise.race([
      promise,
      new Promise((_, reject) => {
        timeoutId = timerApi.setTimeout(() => {
          reject(new Error(`OmniRoute timed out after ${Math.round(timeoutMs / 1000)} seconds. Please try again or choose another model.`))
        }, timeoutMs)
      }),
    ])
  } finally {
    if (timeoutId) timerApi.clearTimeout(timeoutId)
  }
}

/**
 * Non-streaming OmniRoute call
 */
async function callOmniRoute(messages, responseFormat = null, config = {}) {
  try {
    const body = {
      model: config.model || DEFAULT_MODEL,
      messages,
      stream: false,
    }

    if (responseFormat) {
      body.response_format = responseFormat
    }
    if (config.thinking && supportsThinking(body.model)) {
      body.reasoning_effort = config.thinking.toLowerCase()
    }

    await assertModelRoutable(body.model)

    console.info('[LearnLedger] OmniRoute request', {
      model: body.model,
      stream: false,
      ...getAttachmentLogDetails(config.attachment),
    })

    const response = await fetchOmniRoute(body)

    if (!response.ok) {
      let errText = ''
      try {
        errText = await readOmniRouteBody(response.text())
      } catch (error) {
        if (error?.message?.includes('timed out')) throw error
      }
      throw createOmniRouteStatusError(response.status, errText)
    }

    let data
    try {
      data = await readOmniRouteBody(response.json())
    } catch (error) {
      if (error?.message?.includes('timed out')) throw error
      throw new Error('OmniRoute returned a non-JSON completion response.')
    }
    const content = data?.choices?.[0]?.message?.content
    if (!content) {
      throw new Error('OmniRoute returned an empty response.')
    }
    return content.trim()
  } catch (error) {
    console.error('OmniRoute request failed:', {
      message: error?.message,
      model: config.model || DEFAULT_MODEL,
      ...getAttachmentLogDetails(config.attachment),
    })
    if (isOmniRouteModelUnavailableError(error)) throw error
    if (error.message === 'Failed to fetch' || error.message?.includes('NetworkError') || error.message?.includes('ECONNREFUSED')) {
      throw new Error(
        `OmniRoute is not running. Please start OmniRoute on http://localhost:20128 and try again.`
      )
    }
    throw new Error(
      `OmniRoute error: ${error.message}`
    )
  }
}

/**
 * Streaming OmniRoute call
 * Yields string chunks as they arrive.
 */
export async function* callOmniRouteStream(messages, config = {}) {
  const body = {
    model: config.model || DEFAULT_MODEL,
    messages,
    stream: true,
  }

  if (config.thinking && supportsThinking(body.model)) {
    body.reasoning_effort = config.thinking.toLowerCase()
  }

  await assertModelRoutable(body.model)

  console.info('[LearnLedger] OmniRoute request', {
    model: body.model,
    stream: true,
    ...getAttachmentLogDetails(config.attachment),
  })

  let response
  try {
    response = await fetchOmniRoute(body)
  } catch (fetchError) {
    if (fetchError.message === 'Failed to fetch' || fetchError.message?.includes('NetworkError') || fetchError.message?.includes('ECONNREFUSED')) {
      throw new Error(
        `OmniRoute is not running. Please start OmniRoute on http://localhost:20128 and try again.`
      )
    }
    throw fetchError
  }

  if (!response.ok) {
    let errText = ''
    try {
      errText = await readOmniRouteBody(response.text())
    } catch (error) {
      if (error?.message?.includes('timed out')) throw error
    }
    console.error('OmniRoute streaming request failed:', {
      status: response.status,
      model: body.model,
      ...getAttachmentLogDetails(config.attachment),
      error: errText.slice(0, 500),
    })
    throw createOmniRouteStatusError(response.status, errText)
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''
  let sawContent = false
  let sawNonPingEvent = false

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || '' // keep the last incomplete line in the buffer

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || trimmed.startsWith(':')) continue
        if (trimmed === 'data: [DONE]') {
          if (!sawNonPingEvent) {
            throw new Error(`OmniRoute stream ended before producing a non-ping SSE event for model "${body.model}". This usually means the selected provider route is unavailable.`)
          }
          if (!sawContent) {
            throw new Error(`OmniRoute stream completed without assistant content for model "${body.model}".`)
          }
          return
        }
        if (trimmed.startsWith('data:')) {
          const jsonStr = trimmed.slice(5).trim()
          if (!jsonStr) continue
          
          try {
            const data = JSON.parse(jsonStr)
            if (data?.type === 'ping' || data?.event === 'ping') continue
            if (data?.error) {
              const errorMessage = data.error.message || data.error.code || 'Unknown streaming provider error'
              throw new Error(errorMessage)
            }

            sawNonPingEvent = true
            const chunk = data?.choices?.[0]?.delta?.content
            if (chunk) {
              sawContent = true
              yield chunk
            }
          } catch (e) {
            if (!(e instanceof SyntaxError)) throw e
          }
        }
      }
    }

    const tail = decoder.decode()
    if (tail) buffer += tail

    if (!sawNonPingEvent) {
      throw new Error(`OmniRoute stream ended before producing a non-ping SSE event for model "${body.model}". This usually means the selected provider route is unavailable.`)
    }

    if (!sawContent) {
      throw new Error(`OmniRoute stream completed without assistant content for model "${body.model}".`)
    }
  } finally {
    reader.releaseLock()
  }
}

function getRequestedDifficultyMix(text) {
  const source = String(text || '').toLowerCase()
  const counts = {
    easy: Number(source.match(/\b(\d{1,2})\s*easy\b/)?.[1] || 0),
    medium: Number(source.match(/\b(\d{1,2})\s*medium\b/)?.[1] || 0),
    hard: Number(source.match(/\b(\d{1,2})\s*hard\b/)?.[1] || 0),
  }
  const requestedTotal = counts.easy + counts.medium + counts.hard

  if (requestedTotal > 0) {
    return {
      counts,
      label: `exactly ${counts.easy} easy, ${counts.medium} medium, and ${counts.hard} hard questions`,
      fallbackDifficulty: counts.medium >= counts.easy && counts.medium >= counts.hard
        ? 'medium'
        : counts.easy >= counts.hard
          ? 'easy'
          : 'hard',
    }
  }

  return {
    counts: null,
    label: `a balanced mix across easy, medium, and hard difficulty`,
    fallbackDifficulty: 'medium',
  }
}

/**
 * Generate a real test based on the topic & details via OmniRoute.
 */
export async function generateRealTest({ intent, config = {}, attachment = null }) {
  if (intent?.action !== 'generate_test' || !intent.topic) {
    throw new Error('A valid test topic is required before questions can be generated.')
  }
  if (!Number.isInteger(intent.questionCount) || intent.questionCount < 1 || intent.questionCount > 50) {
    throw new Error('Question count must be between 1 and 50 before questions can be generated.')
  }
  if (!['easy', 'medium', 'hard', 'mixed'].includes(intent.difficulty)) {
    throw new Error('A valid difficulty is required before questions can be generated.')
  }

  const topic = intent.topic
  const questionCount = intent.questionCount
  const details = buildGenerationDetails(intent)
  const difficultyMix = intent.difficulty === 'mixed'
    ? getRequestedDifficultyMix('mixed')
    : {
      counts: null,
      label: `all ${intent.difficulty} questions`,
      fallbackDifficulty: intent.difficulty,
    }
  const prompt = `You are an expert competitive exam tutor for a BCA 5th semester student preparing for the RSSB Informatics Assistant exam. Generate a multiple-choice practice test on the topic: "${topic}".
Generation requirements: "${details}".

Generate exactly ${questionCount} questions matching the difficulty and syllabus of the RSSB Informatics Assistant (IA) exam, suitable for a BCA student.
Difficulty distribution: ${difficultyMix.label}.
Prioritize competitive-exam oriented learning, conceptual understanding, practical examples, and exam-focused reasoning over rote definitions.
When relevant, align with RSSB Informatics Assistant previous-year style and topic priorities. Do not invent previous-year claims if no source/context is available.
For Computer Networks, TCP/IP, Cybersecurity, Linux, Programming, DSA, and Computer Fundamentals, prefer realistic practical and conceptual scenarios.
The "question" must be clear, exam-oriented, and realistic for Easy/Medium/Hard levels.
Incorrect options must be strong exam-style distractors: plausible, conceptually close, but clearly wrong.
The "explanation" MUST be written in natural Hinglish with Hindi words in Devanagari script and technical terms in English. Example: "इस question में subnet mask network और host portion को अलग करता है।"
The explanation should be friendly, concise, conceptual, and practical when useful.

You MUST output ONLY one valid JSON object, with no other text, markdown blocks, or commentary.
The JSON object must have a "questions" array.
Each item in the array must be an object with the following exact keys:
- "question": string (the question text)
- "options": object with keys "A", "B", "C", "D" (keys must be uppercase)
- "correctAnswer": string (must be exactly "A", "B", "C", or "D")
- "explanation": string (detailed natural Hinglish explanation with Hindi words in Devanagari script explaining why the choice is correct)
- "difficulty": string (must be exactly "easy", "medium", or "hard")

Return this exact JSON shape:
{
  "questions": [
    {
      "question": "Question text",
      "options": { "A": "Option A", "B": "Option B", "C": "Option C", "D": "Option D" },
      "correctAnswer": "A",
      "explanation": "इस question में core concept को समझना important है। Correct option इसलिए सही है क्योंकि...",
      "difficulty": "medium"
    }
  ]
}`

  const messages = [
    { role: 'system', content: 'You are a strict test-generator AI for RSSB Informatics Assistant preparation. You only output one valid JSON object with a questions array.' },
    { role: 'user', content: buildUserContent(prompt, attachment) }
  ]

  const generationConfig = getStructuredTestModelConfig(config, attachment)
  if (generationConfig.routedFromModel) {
    console.info('[LearnLedger] Routing text-only structured test generation to JSON-capable model', {
      from: generationConfig.routedFromModel,
      to: generationConfig.model,
    })
  }

  let rawJson = await callOmniRoute(messages, { type: 'json_object' }, generationConfig)
  let parsedQuestions

  try {
    parsedQuestions = parseAIResponse(rawJson, {
      fallbackDifficulty: difficultyMix.fallbackDifficulty,
      expectReviewFields: true,
      expectedQuestionCount: questionCount,
    })
  } catch (parseError) {
    const canRetryWithStructuredModel = generationConfig.model !== STRUCTURED_TEST_MODEL
    if (!canRetryWithStructuredModel) throw parseError

    console.warn('[LearnLedger] Structured test generation returned invalid JSON; retrying with JSON-capable text model.', {
      failedModel: generationConfig.model,
      retryModel: STRUCTURED_TEST_MODEL,
      error: parseError?.message,
      rawPreview: String(rawJson || '').slice(0, 120),
    })

    rawJson = await callOmniRoute(messages, { type: 'json_object' }, {
      ...generationConfig,
      model: STRUCTURED_TEST_MODEL,
      routedFromModel: generationConfig.model,
    })
    parsedQuestions = parseAIResponse(rawJson, {
      fallbackDifficulty: difficultyMix.fallbackDifficulty,
      expectReviewFields: true,
      expectedQuestionCount: questionCount,
    })
  }

  const normalizedQuestions = parsedQuestions.map((q, idx) => ({
    ...q,
    id: `q_${Date.now()}_${idx}_${uid()}`,
    questionNumber: idx + 1
  }))

  return {
    id: `test_${Date.now()}_${uid()}`,
    createdAt: new Date().toISOString(),
    topic: String(topic || 'Practice Test').trim(),
    title: String(topic || 'Practice Test').trim(),
    metadata: {
      context: details,
      source: 'omniroute-ai',
      testType: 'ai-chat',
      intent: {
        topic,
        questionCount,
        difficulty: intent.difficulty,
        questionType: intent.questionType,
      },
    },
    config: {
      topic: String(topic || '').trim(),
      questionCount: normalizedQuestions.length,
      difficulty: intent.difficulty,
      scope: 'ai-chat'
    },
    questions: normalizedQuestions,
    questionCount: normalizedQuestions.length,
    status: 'in-progress',
    answers: {},
    currentQuestionIndex: 0,
    bookmarkedQuestions: [],
    hintsUsed: [],
  }
}

/**
 * Generate a contextual chat response using local OmniRoute server.
 * Uses Generator pattern for streaming chunks.
 */
export async function* generateRealAIResponseStream(prompt = '', activeSession = null, config = {}) {
  const query = String(prompt).trim().toLowerCase()
  const attachment = config.attachment || null
  const intent = extractTestIntent(prompt)

  if (intent.action === 'ambiguous') {
    yield { text: intent.reason, testData: null }
    return { text: intent.reason, testData: null }
  }

  if (intent.action === 'generate_test') {
    yield `"${intent.topic}" पर नया practice test बना रहा हूँ... थोड़ा wait करो।`
    
    const generatedTest = await generateRealTest({
      intent,
      config,
      attachment,
    })
    
    // We signal completion by returning the final object (which includes testData)
    const finalResult = {
      text: `"${generatedTest.topic}" पर नया practice test ready है। नीचे वाले button से test start करो।`,
      testData: generatedTest,
    }
    yield finalResult
    return finalResult
  }

  const isFollowUpTestRequest = /another|new|retake|again|follow-up|practice/i.test(query)
    && activeSession?.test

  if (isFollowUpTestRequest) {
    const nextTopic = `Revision: ${activeSession.test.topic}`
    yield `"${nextTopic}" पर revision test बना रहा हूँ... थोड़ा wait करो।`
    
    const testData = await generateRealTest({
      intent: {
        action: 'generate_test',
        topic: nextTopic,
        questionCount: 5,
        difficulty: 'mixed',
        questionType: 'multiple_choice',
      },
      config,
    })
    const finalResult = {
      text: `"${nextTopic}" पर revision test ready है। नीचे से start करो।`,
      testData,
    }
    yield finalResult
    return finalResult
  }

  // Format message history for OmniRoute
  const messages = []

  messages.push({
    role: 'system',
    content: `You are LearnLedger's personalized AI study assistant for a BCA 5th semester student preparing for the RSSB Informatics Assistant exam.
Use natural Hinglish as the primary language: write Hindi words in Devanagari script and keep technical terms in English.
Keep the tone friendly, clear, concise, conversational, and easy to understand.
Prioritize conceptual understanding over rote memorization, with practical examples when they genuinely help.
For exam-related questions, prefer competitive-exam oriented explanations, realistic practice, and RSSB Informatics Assistant pattern/trend awareness when available. Do not invent previous-year facts if not known from context.
When relevant, lean into Computer Networks, TCP/IP, Cybersecurity, Linux, Programming, DSA, and Computer Fundamentals.
Do not force exam context into unrelated conversations.`
  })

  // Optimize context payload: Only send relevant test context
  if (activeSession?.test) {
    const test = activeSession.test
    const isAskingAboutTest = /test|question|result|score|wrong|mistake|fail|weak|topic|retake|explain/i.test(query)
    
    if (isAskingAboutTest) {
      const storedResultContext = test.resultContext || test.metadata?.resultContext || null
      // Find specific questions if mentioned
      const questionMatch = query.match(/question\s*(\d+)/i)
      let focusedQuestions = test.questions

      if (questionMatch && questionMatch[1]) {
        const qNum = parseInt(questionMatch[1], 10)
        focusedQuestions = test.questions.filter(q => q.questionNumber === qNum)
      } else {
        // Send only summary + wrong answers to save tokens unless full context needed
        focusedQuestions = test.questions.filter(q => {
          const uAns = test.answers?.[q.id]
          return uAns !== q.correctAnswer
        })
      }

      const summary = {
        topic: test.topic,
        title: test.title,
        testId: test.id,
        status: test.status,
        completedAt: test.completedAt || test.endTime || null,
        score: storedResultContext?.score || test.scoreResult || {
          correct: test.correct ?? test.score ?? null,
          incorrect: test.incorrect ?? null,
          skipped: test.unanswered ?? null,
          totalQuestions: test.totalQuestions ?? test.questions?.length ?? null,
          percentage: test.percentage ?? null,
        },
        full_result_context: storedResultContext,
        relevant_questions: focusedQuestions.map((q) => ({
          number: q.questionNumber,
          question: q.question,
          options: q.options,
          correctAnswer: q.correctAnswer,
          userAnswer: test.answers?.[q.id] || 'Skipped',
          explanation: q.explanation
        }))
      }

      messages.push({
        role: 'system',
        content: `CONTEXT: The user is asking about their test. Relevant data:\n${JSON.stringify(summary)}`
      })
    }
  }

  // Include recent chat history (limit to last 10 messages to save context)
  const history = activeSession?.messages || []
  const recentHistory = history.slice(-10)
  recentHistory.forEach((msg) => {
    // Only include string content, do not send the whole testData object
    if (msg.role !== 'system') {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      })
    }
  })

  messages.push({ role: 'user', content: buildUserContent(prompt, attachment) })

  // Normal streaming response
  let fullResponse = ''
  const stream = callOmniRouteStream(messages, config)
  for await (const chunk of stream) {
    fullResponse += chunk
    yield fullResponse
  }

  return {
    text: fullResponse.trim(),
    testData: null
  }
}
