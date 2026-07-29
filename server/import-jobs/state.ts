export type ImportJobStage =
  | 'queued'
  | 'preparing'
  | 'trades'
  | 'backtests'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface ImportJobState {
  phase: 'preparing' | 'trades' | 'backtests' | 'completed'
  tradeIndex: number
  backtestIndex: number
  imported: number
  skipped: number
}

export const DEFAULT_JOB_STATE: ImportJobState = {
  phase: 'preparing',
  tradeIndex: 0,
  backtestIndex: 0,
  imported: 0,
  skipped: 0,
}

export function parseJobState(state: unknown): ImportJobState {
  if (!state || typeof state !== 'object') return { ...DEFAULT_JOB_STATE }
  const candidate = state as Partial<ImportJobState>
  return {
    phase: candidate.phase ?? 'preparing',
    tradeIndex: Number.isFinite(candidate.tradeIndex)
      ? Number(candidate.tradeIndex)
      : 0,
    backtestIndex: Number.isFinite(candidate.backtestIndex)
      ? Number(candidate.backtestIndex)
      : 0,
    imported: Number.isFinite(candidate.imported)
      ? Number(candidate.imported)
      : 0,
    skipped: Number.isFinite(candidate.skipped)
      ? Number(candidate.skipped)
      : 0,
  }
}

export function computeProcessingProgress(
  totalItems: number,
  processedItems: number,
): number {
  if (totalItems <= 0) return 95
  const clamped = Math.max(0, Math.min(processedItems, totalItems))
  return Math.min(95, 10 + Math.floor((clamped / totalItems) * 85))
}
