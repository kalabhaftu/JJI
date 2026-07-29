import { inngest } from '@/lib/inngest/client'

export type ImportJobKind = 'archive' | 'trade'

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
