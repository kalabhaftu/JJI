export type InngestImportJobKind = 'archive' | 'trade'

export type ImportProcessEventData = {
  jobId: string
  internalUserId: string
  kind: InngestImportJobKind
  requestId?: string
}

export type PhaseEvaluationEventData = {
  source: string
  masterAccountId?: string
  phaseAccountId?: string
  requestId?: string
  requestedAt?: string
}

export type StorageCleanupEventData = {
  internalUserId: string
  storageOwnerIds: string[]
  requestId?: string
}

export type DailyAnchorResetEventData = {
  requestId?: string
}

export type WhopWebhookEventData = {
  eventId: string
  requestId?: string
}

export type WhopReconcileEventData = {
  requestId?: string
}

export type JjiInngestEvents = {
  'jji/import.process': { data: ImportProcessEventData }
  'jji/phase.evaluate': { data: PhaseEvaluationEventData }
  'jji/user-data.storage-cleanup': { data: StorageCleanupEventData }
  'cron/daily-anchor-reset': { data: DailyAnchorResetEventData }
  'jji/import.migrate-legacy-objects': { data: Record<string, unknown> }
  'jji/billing.whop-webhook': { data: WhopWebhookEventData }
  'jji/billing.whop-reconcile': { data: WhopReconcileEventData }
}
