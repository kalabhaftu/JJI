'use client'

import { apiRequest } from '@/lib/api/client'
import { ApiClientError } from '@/lib/api/errors'
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

  let rateLimitRetries = 0
  const MAX_RATE_LIMIT_RETRIES = 5

  while (!isTerminal(job.status)) {
    try {
      const processed = await apiRequest<ImportJobPayload>(
        `/api/v1/trades/import/jobs/${job.id}/process`,
        { method: 'POST' },
      )
      if (!processed.data?.job) {
        throw new Error('The import service returned no job state')
      }

      job = processed.data.job
      rateLimitRetries = 0
      input.onProgress?.(job)
      if (!isTerminal(job.status)) {
        await new Promise((resolve) => window.setTimeout(resolve, IMPORT_JOB_PROCESS_SPACER_MS))
      }
    } catch (err) {
      if (err instanceof ApiClientError && err.status === 429 && rateLimitRetries < MAX_RATE_LIMIT_RETRIES) {
        rateLimitRetries += 1
        const waitMs = Math.min((err.retryAfterSeconds ?? (rateLimitRetries * 2)) * 1000, 10_000)
        await new Promise((resolve) => window.setTimeout(resolve, waitMs))
        continue
      }
      throw err
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
