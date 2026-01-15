/**
 * Sanitize a URL to prevent XSS attacks via javascript:, data:, or other dangerous protocols.
 * Only allows http:// and https:// URLs.
 * Returns null if the URL is invalid or potentially malicious.
 */
export function sanitizeUrl(url: string | null | undefined): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  // Trim and lowercase for checking
  const trimmed = url.trim()
  const lower = trimmed.toLowerCase()

  // Block dangerous protocols
  const dangerousProtocols = [
    'javascript:',
    'data:',
    'vbscript:',
    'file:',
    'blob:',
  ]

  for (const protocol of dangerousProtocols) {
    if (lower.startsWith(protocol)) {
      return null
    }
  }

  // Only allow http and https
  if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
    // If no protocol, assume https
    if (!lower.includes('://')) {
      return `https://${trimmed}`
    }
    // Unknown protocol - block it
    return null
  }

  return trimmed
}

/**
 * Check if a URL is safe to render in an href attribute.
 * Use this for conditional rendering.
 */
export function isValidUrl(url: string | null | undefined): boolean {
  return sanitizeUrl(url) !== null
}
