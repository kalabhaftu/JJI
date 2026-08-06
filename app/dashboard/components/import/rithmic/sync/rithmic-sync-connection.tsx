'use client'

import { Button } from "@/components/ui/button"
import { ArrowLeft, Construction } from "lucide-react"

interface RithmicSyncWrapperProps {
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>
  onBack?: () => void
}

export function RithmicSyncWrapper({ setIsOpen, onBack }: RithmicSyncWrapperProps) {
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
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
        )}
        <div className="flex flex-col space-y-1">
          <h2 className="text-lg font-semibold">Rithmic Auto Sync</h2>
          <p className="text-sm text-muted-foreground">
            Direct broker sync
          </p>
        </div>
      </div>
      <div className="flex flex-col items-center justify-center gap-4 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5 p-8 text-center">
        <Construction className="h-10 w-10 text-amber-500" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-amber-500">Under Development</p>
          <p className="text-sm text-muted-foreground max-w-xs">
            Rithmic live sync is not yet available. Use CSV import or TradingView webhooks in the meantime.
          </p>
        </div>
      </div>
    </div>
  )
}

