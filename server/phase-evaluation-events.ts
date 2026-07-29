import { inngest } from '@/lib/inngest/client'

export async function enqueuePhaseEvaluation(params: {
  source: string
  masterAccountId?: string
  phaseAccountId?: string
  requestId?: string
}) {
  await inngest.send({
    name: 'jji/phase.evaluate',
    data: {
      source: params.source,
      ...(params.masterAccountId ? { masterAccountId: params.masterAccountId } : {}),
      ...(params.phaseAccountId ? { phaseAccountId: params.phaseAccountId } : {}),
      ...(params.requestId ? { requestId: params.requestId } : {}),
      requestedAt: new Date().toISOString(),
    },
  })
}
