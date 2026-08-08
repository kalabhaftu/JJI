'use client'

import { Button } from "@/components/ui/button"
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ConstructionIcon } from '@hugeicons/core-free-icons'

export function DxFeedSync({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-col space-y-6 p-6">
      <div className="flex items-start gap-4">
        {onBack && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onBack}
            className="mt-1 h-8 px-3 text-xs border-border/50 hover:bg-muted"
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5 mr-1" strokeWidth={2} />
            Back
          </Button>
        )}
        <div className="flex flex-col space-y-1">
          <h2 className="text-lg font-semibold">DxFeed Auto Sync</h2>
          <p className="text-sm text-muted-foreground">
            Direct broker sync
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center">
        <HugeiconsIcon icon={ConstructionIcon} className="h-10 w-10 text-amber-500" strokeWidth={2} />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-500">Under Development</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            DxFeed live sync is not yet available. Use CSV import or TradingView webhooks in the meantime.
          </p>
        </div>
      </div>
    </div>
  )
}
