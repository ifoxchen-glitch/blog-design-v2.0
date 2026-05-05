/**
 * Format byte size to human-readable string.
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const s = (bytes / Math.pow(k, i)).toFixed(i > 0 ? 1 : 0)
  return `${s} ${units[i]}`
}
