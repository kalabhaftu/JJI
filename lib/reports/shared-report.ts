export interface SharedReportRowLike {
  id: string
  slug: string
  title: string
  dateFrom: string | null
  dateTo: string | null
  isPublic: boolean
  expiresAt: Date | string | null
  snapshot: unknown
  viewCount: number
  createdAt: string
}

export interface SharedReportContent {
  psych: Record<string, unknown>
  activity: Record<string, unknown>
  sessions: Record<string, unknown> | null
  rDataQuality: Record<string, unknown> | null
}

export interface SharedReportData extends SharedReportRowLike {
  content: SharedReportContent
}

export type SharedReportState =
  | { status: 'valid'; report: SharedReportData }
  | { status: 'expired' }
  | { status: 'revoked' }
  | { status: 'malformed' }
  | { status: 'unavailable' }

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function parseSharedReportSnapshot(snapshot: unknown): SharedReportContent | null {
  if (!isRecord(snapshot)) return null

  const reportData = isRecord(snapshot.reportData) ? snapshot.reportData : snapshot
  const psych = isRecord(reportData.psychMetrics) ? reportData.psychMetrics : null
  const activity = isRecord(reportData.tradingActivity) ? reportData.tradingActivity : null
  if (!psych || !activity) return null

  return {
    psych,
    activity,
    sessions: isRecord(reportData.sessionPerformance) ? reportData.sessionPerformance : null,
    rDataQuality: isRecord(reportData.rMultipleDataQuality)
      ? reportData.rMultipleDataQuality
      : null,
  }
}

export function classifySharedReportState(
  row: SharedReportRowLike | null | undefined,
  now: Date,
): SharedReportState {
  if (!row) return { status: 'unavailable' }
  if (row.isPublic === false) return { status: 'revoked' }
  if (row.expiresAt && new Date(row.expiresAt) < now) return { status: 'expired' }
  if (!isRecord(row.snapshot)) return { status: 'malformed' }

  const content = parseSharedReportSnapshot(row.snapshot)
  if (!content) return { status: 'unavailable' }

  return { status: 'valid', report: { ...row, content } }
}
