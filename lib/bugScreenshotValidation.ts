const BUG_SCREENSHOT_ALLOWED_MIME_TYPES = [
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]

const BUG_SCREENSHOT_MAX_SIZE_BYTES = 5 * 1024 * 1024

type BugScreenshotValidationResult =
  | { valid: true }
  | { valid: false; message: string }

const getExtensionForMime = (mimeType: string): string | null => {
  switch (mimeType) {
    case 'image/png':
      return 'png'
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg'
    case 'image/webp':
      return 'webp'
    default:
      return null
  }
}

const generateRandomId = (): string => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export const validateBugScreenshot = (
  file?: File | null
): BugScreenshotValidationResult => {
  if (!file) {
    return { valid: true }
  }

  if (!BUG_SCREENSHOT_ALLOWED_MIME_TYPES.includes(file.type)) {
    return { valid: false, message: 'Apenas imagens PNG, JPG ou WEBP sao permitidas.' }
  }

  if (file.size > BUG_SCREENSHOT_MAX_SIZE_BYTES) {
    return { valid: false, message: 'A imagem deve ter no maximo 5MB.' }
  }

  return { valid: true }
}

export const buildBugScreenshotPath = (
  userId: string,
  reportId: string,
  file: File
): string => {
  const extension = getExtensionForMime(file.type)
  if (!extension) {
    throw new Error('Unsupported screenshot type.')
  }

  const fileId = generateRandomId()
  return `${userId}/${reportId}/${fileId}.${extension}`
}

export {
  BUG_SCREENSHOT_ALLOWED_MIME_TYPES,
  BUG_SCREENSHOT_MAX_SIZE_BYTES,
}
