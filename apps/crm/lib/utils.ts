/**
 * Ensures a URL has a protocol (http:// or https://)
 * Handles case-insensitive protocol detection (e.g., "Https://")
 */
export function ensureProtocol(url: string | null | undefined): string {
  if (!url) return ''
  const trimmed = url.trim()
  // Case-insensitive check for existing protocol
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed
  }
  return `https://${trimmed}`
}
