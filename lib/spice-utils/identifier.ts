export function sanitizeIdentifier(value: string | undefined, prefix: string) {
  if (!value) return prefix
  const sanitized = value.replace(/[^A-Za-z0-9_]/g, "_")
  if (!sanitized) return prefix
  if (/^[0-9]/.test(sanitized)) {
    return `${prefix}_${sanitized}`
  }
  return sanitized
}
