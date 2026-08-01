import { inngest } from '@/lib/inngest/client'
import type { InngestImportJobKind } from '@/lib/inngest/events'

export type ImportJobKind = InngestImportJobKind

export async function enqueueImportJob(params: {
  jobId: string
  internalUserId: string
  kind: ImportJobKind
  requestId?: string
}) {
  return inngest.send({
    name: 'jji/import.process',
    data: params,
  })
}
