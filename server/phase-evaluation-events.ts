import { inngest } from '@/lib/inngest/client'
import type { PhaseEvaluationEventData } from '@/lib/inngest/events'

export async function enqueuePhaseEvaluation(params: Omit<PhaseEvaluationEventData, 'requestedAt'>) {
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
