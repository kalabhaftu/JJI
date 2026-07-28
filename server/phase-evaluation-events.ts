import { inngest } from '@/lib/inngest/client'

export async function enqueuePhaseEvaluation(params: {
  source: string
  masterAccountId?: string
  phaseAccountId?: string
}) {
  await inngest.send({
    name: 'jji/phase.evaluate',
    data: {
      source: params.source,
      ...(params.masterAccountId ? { masterAccountId: params.masterAccountId } : {}),
      ...(params.phaseAccountId ? { phaseAccountId: params.phaseAccountId } : {}),
      requestedAt: new Date().toISOString(),
    },
  })
}
