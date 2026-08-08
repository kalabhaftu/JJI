'use client'

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { HugeiconsIcon } from '@hugeicons/react'
import { CopyIcon, RefreshIcon, EyeIcon, ArrowLeft01Icon } from '@hugeicons/core-free-icons'
import { useState } from "react"
import { apiRequest } from '@/lib/api/client'
import { toast } from "sonner"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { useUserStore } from "@/store/user-store"
import { reportClientError } from '@/lib/observability/report-error'

export function ThorSync({ setIsOpen, onBack }: { setIsOpen: (isOpen: boolean) => void; onBack?: () => void }) {
  const [isGenerating, setIsGenerating] = useState(false)
  const [isRevealed, setIsRevealed] = useState(false)
  const user = useUserStore((state) => state.user)
  const setUser = useUserStore((state) => state.setUser)

  const handleGenerateToken = async () => {
    try {
      setIsGenerating(true)
      setIsRevealed(false)
      const response = await apiRequest<{ token: string }>('/api/v1/thor/token', {
        method: 'POST',
      })
      const token = response.data?.token
      if (!token) {
        toast.error('Failed to generate Thor API Token')
        return
      }
      if (!user) return
      setUser({ ...user, thorToken: token })
      toast.success('Thor API Token generated successfully')
    } catch (error) {
      reportClientError(error, { operation: 'generate-thor-token', route: '/api/v1/thor/token' })
      toast.error('Failed to generate Thor API Token')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleCopyToken = () => {
    if (!user?.thorToken) return
    navigator.clipboard.writeText(user.thorToken)
    toast.success('API Token copied to clipboard')
  }

  const getMaskedToken = () => {
    if (!user?.thorToken) return ''
    return '•'.repeat(user.thorToken.length)
  }

  return (
    <div className="flex flex-col space-y-4 p-6">
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
          <h2 className="text-lg font-semibold">Thor Copy Trader Sync</h2>
          <p className="text-sm text-muted-foreground">
            Connect Thor Copy Trader to automatically sync your trades in real-time. Thor runs as a local background process on your machine and forwards execution events directly to our API.
          </p>
        </div>
      </div>

      <div className="flex space-x-2">
        {isGenerating ? (
          <Skeleton className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background" />
        ) : (
          <Input
            value={isRevealed ? (user?.thorToken || '') : getMaskedToken()}
            readOnly
            placeholder="No API token generated yet"
            className="font-mono"
          />
        )}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              disabled={!user?.thorToken || isGenerating}
              aria-label="Reveal Thor API Token"
            >
              <HugeiconsIcon icon={EyeIcon} className="h-4 w-4" strokeWidth={2} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Reveal Thor API Token</AlertDialogTitle>
              <AlertDialogDescription>
                Your API token grants write access to import trades into your account. Do not share this token or expose it on public screens.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setIsRevealed(false)}>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => setIsRevealed(true)}>Reveal</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleCopyToken}
          disabled={!user?.thorToken || isGenerating}
          aria-label="Copy Thor API Token"
        >
          <HugeiconsIcon icon={CopyIcon} className="h-4 w-4" strokeWidth={2} />
        </Button>
        <Button
          variant="secondary"
          size="icon"
          onClick={handleGenerateToken}
          disabled={isGenerating}
          aria-label="Generate new Thor API Token"
        >
          <HugeiconsIcon icon={RefreshIcon} className={cn("h-4 w-4", {
            "animate-spin": isGenerating
          })}  strokeWidth={2}/>
        </Button>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>Note: Generating a new token will immediately invalidate your previous Thor integration token. Ensure you update the token in your local Thor agent settings.</p>
      </div>

      <div className="mt-6 border-t pt-6 space-y-4">
        <h3 className="text-base font-semibold text-foreground">How to configure Thor Copy Trader</h3>
        
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="border border-border/60 bg-muted/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              <h4 className="text-sm font-semibold">Generate Token</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Click the refresh/generate button above to create a secure API access token. Copy this token to your clipboard.
            </p>
          </div>

          <div className="border border-border/60 bg-muted/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
              <h4 className="text-sm font-semibold">Copy API Endpoint</h4>
            </div>
            <div className="space-y-1.5">
              <p className="text-xs text-muted-foreground">
                Set your Thor client's endpoint URL to our API receiver:
              </p>
              <div className="flex items-center gap-1.5 bg-background border rounded-lg px-2.5 py-1 text-[11px] font-mono select-all">
                <span className="truncate flex-1 text-muted-foreground">
                  {typeof window !== 'undefined' ? `${window.location.origin}/api/v1/thor/store` : '/api/v1/thor/store'}
                </span>
                <Button
                  variant="tertiary"
                  size="icon"
                  aria-label="Copy Thor endpoint URL"
                  title="Copy endpoint URL"
                  className="h-5 w-5 hover:bg-muted"
                  onClick={() => {
                    if (typeof window !== 'undefined') {
                      navigator.clipboard.writeText(`${window.location.origin}/api/v1/thor/store`)
                      toast.success('Endpoint URL copied to clipboard')
                    }
                  }}
                >
                  <HugeiconsIcon icon={CopyIcon} className="h-3 w-3" strokeWidth={2} />
                </Button>
              </div>
            </div>
          </div>

          <div className="border border-border/60 bg-muted/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
              <h4 className="text-sm font-semibold">Configure Local Agent</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Open the Thor Copy Trader application on your machine, go to settings, and paste the API Endpoint and your secure API Token under the authorization section.
            </p>
          </div>

          <div className="border border-border/60 bg-muted/20 rounded-xl p-4 space-y-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</span>
              <h4 className="text-sm font-semibold">Enable Real-Time Sync</h4>
            </div>
            <p className="text-xs text-muted-foreground">
              Ensure the local copier is active and running while you trade. Trade executions will sync instantly with JJI.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
