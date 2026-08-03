import { AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import type { PhaseValidationResult } from '@/lib/validation/phase-validation'

export async function validateBeforeManualTradeSave<T>(
  values: T,
  validate: (values: T) => Promise<PhaseValidationResult>,
  save: (values: T) => Promise<unknown>,
): Promise<PhaseValidationResult> {
  const result = await validate(values)
  if (result.status === 'blocked') return result
  await save(values)
  return result
}

export function PhaseValidationAlert({ message, onRetry, isRetrying }: { message: string; onRetry(): void; isRetrying: boolean }) {
  return (
    <div role="alert" className="p-4 rounded-lg border border-destructive/50 bg-destructive/10">
      <div className="flex items-center justify-between gap-4 text-destructive">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          <p className="text-sm">{message}</p>
        </div>
        <Button type="button" size="sm" variant="outline" disabled={isRetrying} onClick={onRetry}>Retry validation</Button>
      </div>
    </div>
  )
}
