'use client'

import { apiRequest } from '@/lib/api/client'
import { IMPORT_JOB_PROCESS_SPACER_MS } from '@/lib/constants/intervals'

export interface TradeImportJob {
  id: string
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled'
  stage: string
  progress: number
  totalItems: number
  importedCount: number
  skippedCount: number
  error?: string | null
  meta?: Record<string, unknown>
}

interface ImportJobPayload {
  job: TradeImportJob
  done?: boolean
}

export async function importTradesThroughApi(input: {
  accountId: string
  trades: unknown[]
  onProgress?: (job: TradeImportJob) => void
}): Promise<TradeImportJob> {
  const created = await apiRequest<ImportJobPayload>('/api/v1/trades/import/jobs', {
    method: 'POST',
    body: JSON.stringify({
      accountId: input.accountId,
      trades: input.trades,
    }),
  })

  if (!created.data?.job) {
    throw new Error('The import service returned no job')
  }

  let job = created.data.job
  input.onProgress?.(job)

  while (!isTerminal(job.status)) {
    const processed = await apiRequest<ImportJobPayload>(
      `/api/v1/trades/import/jobs/${job.id}/process`,
      { method: 'POST' },
    )
    if (!processed.data?.job) {
      throw new Error('The import service returned no job state')
    }

    job = processed.data.job
    input.onProgress?.(job)
    if (!isTerminal(job.status)) {
      await new Promise((resolve) => window.setTimeout(resolve, IMPORT_JOB_PROCESS_SPACER_MS))
    }
  }

  if (job.status === 'failed') {
    throw new Error(job.error || 'Import failed')
  }

  return job
}

function isTerminal(status: TradeImportJob['status']): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled'
}
