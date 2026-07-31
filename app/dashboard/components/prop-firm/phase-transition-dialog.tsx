'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import {
  TrendingUp,
  Target,
  DollarSign,
  ArrowRight,
  AlertCircle,
  Trophy,
  CheckCircle2,
  Rocket,
  Key,
  Loader2,
  Sparkles
} from "lucide-react"
import { cn, formatPercent } from "@/lib/utils"

interface PhaseTransitionDialogProps {
  isOpen: boolean
  onClose: () => void
  masterAccountId: string
  currentPhase: {
    phaseNumber: number
    profitTargetPercent?: number
    currentPnL: number
    phaseId: string
  }
  nextPhaseNumber: number
  propFirmName: string
  accountName: string
  evaluationType: string
  onSuccess?: () => void
}

export function PhaseTransitionDialog({
  isOpen,
  onClose,
  masterAccountId,
  currentPhase,
  nextPhaseNumber,
  propFirmName,
  accountName,
  evaluationType,
  onSuccess
}: PhaseTransitionDialogProps) {
  const [nextPhaseId, setNextPhaseId] = useState('')
  const [isTransitioning, setIsTransitioning] = useState(false)
  const router = useRouter()

  /**
   * Helper function to determine if a phase number represents the funded stage
   * based on the evaluation type.
   */
  const isFundedPhase = (phaseNumber: number): boolean => {
    switch (evaluationType) {
      case 'Two Step':
        return phaseNumber >= 3
      case 'One Step':
        return phaseNumber >= 2
      case 'Instant':
        return phaseNumber >= 1
      default:
        return phaseNumber >= 3 // Default to Two Step behavior
    }
  }

  const getPhaseDisplayName = (phaseNumber: number) => {
    if (isFundedPhase(phaseNumber)) return 'Funded'
    return `Phase ${phaseNumber}`
  }

  const handleTransition = async () => {
    if (!nextPhaseId.trim()) {
      toast.error("ID Required", {
        description: "Please enter the account ID for your next phase.",
      })
      return
    }

    try {
      setIsTransitioning(true)

      const response = await fetch(`/api/v1/prop-firm/accounts/${masterAccountId}/transition`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          nextPhaseId: nextPhaseId.trim()
        })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to transition phase')
      }

      toast.success("Phase Transition Successful", {
        description: `You've successfully advanced to ${getPhaseDisplayName(nextPhaseNumber)}! Importing trades to the new phase...`,
        icon: <CheckCircle2 className="h-4 w-4" />
      })

      // Close dialog FIRST to prevent re-triggering
      onClose()

      setNextPhaseId('')

      // Wait a bit before refreshing to allow dialog to close
      setTimeout(() => {
        // Call success callback to refresh data
        onSuccess?.()
      }, 500)

    } catch (error) {
      toast.error("Transition Failed", {
        description: error instanceof Error ? error.message : 'Failed to transition to next phase',
        icon: <AlertCircle className="h-4 w-4" />
      })
    } finally {
      setIsTransitioning(false)
    }
  }

  const getTransitionIcon = () => {
    if (isFundedPhase(nextPhaseNumber)) {
      return <Trophy className="h-10 w-10" />
    }
    return <Sparkles className="h-10 w-10" />
  }

  const getTransitionTitle = () => {
    if (isFundedPhase(nextPhaseNumber)) {
      return "Ready for Funded Account!"
    }
    return `Ready for ${getPhaseDisplayName(nextPhaseNumber)}!`
  }

  const getTransitionMessage = () => {
    if (isFundedPhase(nextPhaseNumber)) {
      return "Congratulations! You've completed the evaluation and are ready for your funded account."
    }
    return `Great job! You've passed ${getPhaseDisplayName(currentPhase.phaseNumber)} and are ready to advance.`
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader className="text-center space-y-4">
          {/* Animated Icon */}
          <div className="mx-auto relative">
            <div className="relative p-4 bg-muted/30 rounded-2xl">
              <div className="absolute inset-0 bg-muted/40 rounded-2xl animate-pulse" />
              <div className="relative text-foreground">
                {getTransitionIcon()}
              </div>
            </div>
            {/* Decorative rings */}
            <div className="absolute -inset-2 bg-muted/10 rounded-2xl blur-xl opacity-50 animate-pulse" />
          </div>

          <div className="space-y-2">
            <DialogTitle className="text-2xl font-bold text-foreground">
              {getTransitionTitle()}
            </DialogTitle>
            <DialogDescription className="text-base">
              {getTransitionMessage()}
            </DialogDescription>
          </div>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Progress Summary */}
          <Card className="border-border bg-muted/30">
            <CardContent className="pt-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{accountName}</span>
                <Badge variant="secondary" className="font-medium">{propFirmName}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current Phase</span>
                <span className="font-semibold">{getPhaseDisplayName(currentPhase.phaseNumber)}</span>
              </div>

              {currentPhase.profitTargetPercent && currentPhase.profitTargetPercent > 0 && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Profit Target</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{formatPercent(currentPhase.profitTargetPercent)}</span>
                    <CheckCircle2 className="h-4 w-4 text-long" />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Current P&L</span>
                <span className={cn(
                  "font-semibold",
                  currentPhase.currentPnL >= 0 ? "text-long" : "text-short"
                )}>
                  {currentPhase.currentPnL >= 0 ? '+' : ''}${currentPhase.currentPnL.toLocaleString()}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Phase Transition Flow */}
          <div className="relative flex items-center justify-center gap-4 py-2">
            <div className="text-center">
              <div className="relative w-14 h-14 bg-long/10 rounded-xl flex items-center justify-center mb-2 transition-all hover:scale-105">
                <CheckCircle2 className="h-6 w-6 text-long" />
              </div>
              <span className="text-sm font-medium">{getPhaseDisplayName(currentPhase.phaseNumber)}</span>
              <div className="text-xs text-muted-foreground">Completed</div>
            </div>

            <ArrowRight className="h-6 w-6 text-muted-foreground animate-pulse" />

            <div className="text-center">
              <div className="relative w-14 h-14 bg-muted/30 rounded-xl flex items-center justify-center mb-2 transition-all hover:scale-105">
                <div className="absolute inset-0 bg-muted/40 rounded-xl animate-pulse" />
                <Rocket className="h-6 w-6 text-foreground relative z-10" />
              </div>
              <span className="text-sm font-medium">{getPhaseDisplayName(nextPhaseNumber)}</span>
              <div className="text-xs text-muted-foreground">Ready</div>
            </div>
          </div>

          {/* Next Phase ID Input */}
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-muted/50 border border-border rounded-lg">
              <div className="p-2 bg-muted rounded-lg">
                <Key className="h-5 w-5 text-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium">
                  Account ID Required
                </div>
                <div className="text-xs text-muted-foreground">
                  Enter your {getPhaseDisplayName(nextPhaseNumber)} account ID to continue
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nextPhaseId" className="text-sm font-medium">
                {getPhaseDisplayName(nextPhaseNumber)} Account ID
              </Label>
              <Input
                id="nextPhaseId"
                value={nextPhaseId}
                onChange={(e) => setNextPhaseId(e.target.value)}
                placeholder={`Enter your ${getPhaseDisplayName(nextPhaseNumber)} account number...`}
                className="text-center font-mono text-lg h-12"
                disabled={isTransitioning}
              />
              <p className="text-xs text-muted-foreground text-center">
                This should be the new account number provided by {propFirmName}
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3 pt-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isTransitioning}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              onClick={handleTransition}
              disabled={!nextPhaseId.trim() || isTransitioning}
              variant="default"
              className="flex-1"
            >
              {isTransitioning ? (
                <>
                  <Spinner className="h-4 w-4mr-2" />
                  Transitioning...
                </>
              ) : (
                <>
                  Start {getPhaseDisplayName(nextPhaseNumber)}
                  <ArrowRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}