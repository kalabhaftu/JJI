'use client'

import { TradovateCredentialsManager } from './tradovate-credentials-manager'
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"

export function TradovateSync({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex flex-col space-y-6 p-6">
      <div className="flex items-start gap-4">
        {onBack && (
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            className="mt-1 h-8 px-3 text-xs border-border/50 hover:bg-muted"
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" />
            Back
          </Button>
        )}
        <div className="flex flex-col space-y-1">
          <h2 className="text-lg font-semibold">Tradovate Auto Sync</h2>
          <p className="text-sm text-muted-foreground">
            Connect your Tradovate account to automatically synchronize your trades daily.
          </p>
        </div>
      </div>
      <TradovateCredentialsManager />
    </div>
  )
}
