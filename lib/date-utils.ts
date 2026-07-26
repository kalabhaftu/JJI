export function formatTimestamp(timestamp: string): string {
  if (timestamp.includes('+00:00')) {
    return timestamp
  }
  if (timestamp.endsWith('Z')) {
    return timestamp.replace('Z', '+00:00')
  }
  return timestamp
}

export function formatDateToTimestamp(date: Date): string {
  return formatTimestamp(date.toISOString())
}
