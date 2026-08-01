export interface TradeImportPayload {
  accountId: string
  trades: any[]
}

export interface TradeImportJobState {
  kind: 'trade_import'
  index: number
  imported: number
  skipped: number
  accountType?: 'prop-firm' | 'live' | undefined
  accountName?: string | undefined
  propFirmName?: string | undefined
  evaluationType?: string | undefined
  phaseNumber?: number | undefined
  phaseAccountId?: string | undefined
  regularAccountId?: string | undefined
  accountNumber?: string | undefined
  masterAccountId?: string | undefined
  evaluation?: {
    isFailed: boolean
    isPassed?: boolean | undefined
    canAdvance?: boolean | undefined
    status?: string | undefined
    message?: string | undefined
    currentPhaseNumber?: number | undefined
    profitTargetProgress?: number | undefined
    currentPnL?: number | undefined
    evaluationType?: string | undefined
    propFirmName?: string | undefined
  } | undefined
  rowErrors?: Array<{ row: number, message: string }>
}

export const DEFAULT_TRADE_IMPORT_STATE: TradeImportJobState = {
  kind: 'trade_import',
  index: 0,
  imported: 0,
  skipped: 0,
}

export function parseTradeImportState(state: unknown): TradeImportJobState {
  if (!state || typeof state !== 'object') return { ...DEFAULT_TRADE_IMPORT_STATE }

  const obj = state as Partial<TradeImportJobState>
  return {
    kind: 'trade_import',
    index: Number.isFinite(obj.index) ? Number(obj.index) : 0,
    imported: Number.isFinite(obj.imported) ? Number(obj.imported) : 0,
    skipped: Number.isFinite(obj.skipped) ? Number(obj.skipped) : 0,
    accountType: obj.accountType,
    accountName: obj.accountName,
    propFirmName: obj.propFirmName,
    evaluationType: obj.evaluationType,
    phaseNumber: Number.isFinite(obj.phaseNumber) ? Number(obj.phaseNumber) : undefined,
    phaseAccountId: obj.phaseAccountId,
    regularAccountId: obj.regularAccountId,
    accountNumber: obj.accountNumber,
    masterAccountId: obj.masterAccountId,
    evaluation: obj.evaluation,
    rowErrors: Array.isArray(obj.rowErrors) ? obj.rowErrors : [],
  }
}

export function serializeTradeImportJob(job: any) {
  const state = parseTradeImportState(job.state)

  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progress: job.progress,
    totalItems: job.totalItems,
    processedItems: job.processedItems,
    importedCount: job.importedCount,
    skippedCount: job.skippedCount,
    cancelRequested: job.cancelRequested,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    completedAt: job.completedAt,
    meta: {
      kind: state.kind,
      accountType: state.accountType,
      accountName: state.accountName,
      propFirmName: state.propFirmName,
      evaluationType: state.evaluationType,
      phaseNumber: state.phaseNumber,
      masterAccountId: state.masterAccountId,
      phaseAccountId: state.phaseAccountId,
      regularAccountId: state.regularAccountId,
      evaluation: state.evaluation,
      rowErrors: state.rowErrors,
    }
  }
}
