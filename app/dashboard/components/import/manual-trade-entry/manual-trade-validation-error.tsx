import { HugeiconsIcon } from '@hugeicons/react'
import { Alert02Icon } from '@hugeicons/core-free-icons'

import { Button } from '@/components/ui/button'

export function ManualTradeValidationError({ message, retry, disabled }: { message: string; retry(): void; disabled: boolean }) {
  return (
    <div role="alert" className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <HugeiconsIcon icon={Alert02Icon} className="h-4 w-4 text-destructive" />
          <p className="text-sm text-destructive">{message}</p>
        </div>
        <Button type="button" variant="secondary" size="sm" disabled={disabled} onClick={retry}>Retry validation</Button>
      </div>
    </div>
  )
}
