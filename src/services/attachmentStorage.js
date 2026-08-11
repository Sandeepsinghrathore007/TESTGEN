import { uid } from '@/utils/id'
import { STORES, get, getAllByIndex, remove, set } from '@/storage/db'
import { extractPdfKnowledgeFromFile } from '@/utils/pdfKnowledge'

export const ACCEPTED_ATTACHMENT_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
  'text/csv',
]

export const ATTACHMENT_ACCEPT_ATTRIBUTE = '.pdf,.png,.jpg,.jpeg,.webp,.txt,.csv,application/pdf,image/png,image/jpeg,image/webp,text/plain,text/csv'
export const MAX_ATTACHMENT_SIZE_BYTES = 10 * 1024 * 1024
const MAX_DOCUMENT_CONTEXT_CHARS = 18_000

const EXTENSION_MIME_TYPES = {
  pdf: 'application/pdf',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  txt: 'text/plain',
  csv: 'text/csv',
}

function extensionFromName(name = '') {
  return String(name).split('.').pop().toLowerCase()
}

export function resolveAttachmentType(file) {
  const fromExtension = EXTENSION_MIME_TYPES[extensionFromName(file?.name)]
  const type = String(file?.type || '').toLowerCase()

  return ACCEPTED_ATTACHMENT_TYPES.includes(type) ? type : fromExtension || null
}

export function getAttachmentKind(mimeType) {
  return String(mimeType || '').startsWith('image/') ? 'image' : 'document'
}

export function validateAttachmentFile(file) {
  if (!file) return { valid: false, error: 'Choose a file to attach.' }

  const mimeType = resolveAttachmentType(file)
  if (!mimeType) {
    return { valid: false, error: 'Unsupported file. Attach a PDF, PNG, JPG, WebP, TXT, or CSV file.' }
  }

  if (file.size <= 0) {
    return { valid: false, error: 'This file is empty. Choose a file with content.' }
  }

  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return {
      valid: false,
      error: `This file is too large. Attach a file up to ${Math.floor(MAX_ATTACHMENT_SIZE_BYTES / (1024 * 1024))} MB.`,
    }
  }

  return { valid: true, mimeType, kind: getAttachmentKind(mimeType) }
}

function toMetadata(record) {
  return {
    id: record.id,
    sessionId: record.sessionId,
    filename: record.filename,
    mimeType: record.mimeType,
    size: record.size,
    kind: record.kind,
    createdAt: record.createdAt,
  }
}

function getFingerprint(file, mimeType) {
  return [mimeType, file.name, file.size, file.lastModified || 0].join(':')
}

export async function saveAttachmentForSession(file, sessionId) {
  const validation = validateAttachmentFile(file)
  if (!validation.valid) throw new Error(validation.error)
  if (!sessionId) throw new Error('Choose a chat before attaching a file.')

  const fingerprint = getFingerprint(file, validation.mimeType)
  const sessionAttachments = await getAllByIndex(STORES.ATTACHMENTS, 'sessionId', sessionId)
  const existing = sessionAttachments.find((attachment) => attachment.fingerprint === fingerprint)
  if (existing) return toMetadata(existing)

  const record = {
    id: `attachment_${Date.now()}_${uid()}`,
    sessionId,
    fingerprint,
    filename: file.name,
    mimeType: validation.mimeType,
    size: file.size,
    kind: validation.kind,
    createdAt: new Date().toISOString(),
    data: file,
  }

  await set(STORES.ATTACHMENTS, record)
  return toMetadata(record)
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read the attached file.'))
    reader.readAsDataURL(blob)
  })
}

async function readDocumentContext(file, mimeType) {
  try {
    if (mimeType === 'application/pdf') {
      const pdfKnowledge = await extractPdfKnowledgeFromFile(file)
      const text = String(pdfKnowledge?.text || pdfKnowledge?.fullText || '').trim()
      if (!text) {
        return {
          text: '',
          warning: 'This PDF has no extractable text. The original PDF is still being sent to OmniRoute, but a provider with native PDF support is required for scanned pages.',
        }
      }
      return { text: text.slice(0, MAX_DOCUMENT_CONTEXT_CHARS), warning: null }
    }

    const text = (await file.text()).trim()
    if (!text) return { text: '', warning: 'The document is empty, so there is no text to send for analysis.' }
    return { text: text.slice(0, MAX_DOCUMENT_CONTEXT_CHARS), warning: null }
  } catch (error) {
    console.warn('Unable to extract document text for OmniRoute fallback:', {
      mimeType,
      filename: file?.name,
      size: file?.size,
      message: error?.message,
    })
    return {
      text: '',
      warning: 'The document could not be text-extracted. The original file is still being sent to OmniRoute for native processing.',
    }
  }
}

export async function getAttachmentForRequest(attachmentId) {
  const attachment = await get(STORES.ATTACHMENTS, attachmentId)
  if (!attachment?.data) throw new Error('The attached file is no longer available. Please attach it again.')

  const dataUrl = await blobToDataUrl(attachment.data)
  const metadata = toMetadata(attachment)
  const documentContext = attachment.kind === 'document'
    ? await readDocumentContext(attachment.data, attachment.mimeType)
    : { text: '', warning: null }
  const requestPart = attachment.kind === 'image'
    ? { type: 'image_url', image_url: { url: dataUrl } }
    : {
        type: 'file',
        file: {
          filename: attachment.filename,
          file_data: dataUrl,
        },
      }

  return {
    ...metadata,
    requestPart,
    contextText: documentContext.text,
    contextWarning: documentContext.warning,
  }
}

export async function deleteAttachmentsForSession(sessionId) {
  if (!sessionId) return

  const attachments = await getAllByIndex(STORES.ATTACHMENTS, 'sessionId', sessionId)
  await Promise.all(attachments.map((attachment) => remove(STORES.ATTACHMENTS, attachment.id)))
}
