'use client'

import React, { useEffect, useState, useRef } from 'react'
import { useTour } from '@/context/tour-context'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { 
  X, 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  Sparkles,
  Settings,
  Palette,
  Compass,
  Plus,
  FileSpreadsheet,
  Trophy,
  Wallet,
  Eye,
  Pencil,
  BookOpen,
  LayoutGrid,
  Calendar,
  Info,
  CheckCircle2
} from 'lucide-react'
import { cn } from '@/lib/utils'

const IconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  welcome: Sparkles,
  settings: Settings,
  theme: Palette,
  navigation: Compass,
  add: Plus,
  import: FileSpreadsheet,
  complete: Trophy,
  accounts: Wallet,
  view: Eye,
  edit: Pencil,
  journal: BookOpen,
  layout: LayoutGrid,
  calendar: Calendar,
  info: Info,
  check: CheckCircle2
}

export const TourTooltip: React.FC = () => {
  const {
    activeTour,
    stepIndex,
    currentStep,
    nextStep,
    prevStep,
    skipTour,
    completeTour,
    isTargetVisible,
    isLoadingTarget,
    paused,
    totalSteps,
  } = useTour()

  const tooltipRef = useRef<HTMLDivElement>(null)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number; height: number } | null>(null)
  const [placement, setPlacement] = useState<'top' | 'bottom' | 'left' | 'right' | 'center'>('center')
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!currentStep || !isTargetVisible || paused) {
      setCoords(null)
      return
    }

    const updateCoords = () => {
      if (!currentStep.targetSelector) {
        setCoords(null)
        return
      }

      const el = document.querySelector(currentStep.targetSelector)
      if (el) {
        const rect = el.getBoundingClientRect()
        setCoords({
          top: rect.top + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          height: rect.height,
        })
      }
    }

    updateCoords()
    window.addEventListener('resize', updateCoords)
    window.addEventListener('scroll', updateCoords)

    // Poll periodically to catch dynamic updates
    const timer = setInterval(updateCoords, 500)

    return () => {
      window.removeEventListener('resize', updateCoords)
      window.removeEventListener('scroll', updateCoords)
      clearInterval(timer)
    }
  }, [currentStep, isTargetVisible, paused])

  useEffect(() => {
    if (!currentStep || paused) return

    // Mobile fallback or centered step
    const isMobile = window.innerWidth < 768
    if (!coords || isMobile || currentStep.placement === 'center') {
      setPlacement('center')
      setPosition(null)
      return
    }

    const tooltipWidth = tooltipRef.current?.offsetWidth || 340
    const tooltipHeight = tooltipRef.current?.offsetHeight || 180
    const targetPlacement = currentStep.placement || 'bottom'

    let top = 0
    let left = 0

    const padding = 12

    if (targetPlacement === 'bottom') {
      top = coords.top + coords.height + padding
      left = coords.left + coords.width / 2 - tooltipWidth / 2
    } else if (targetPlacement === 'top') {
      top = coords.top - tooltipHeight - padding
      left = coords.left + coords.width / 2 - tooltipWidth / 2
    } else if (targetPlacement === 'right') {
      top = coords.top + coords.height / 2 - tooltipHeight / 2
      left = coords.left + coords.width + padding
    } else if (targetPlacement === 'left') {
      top = coords.top + coords.height / 2 - tooltipHeight / 2
      left = coords.left - tooltipWidth - padding
    }

    // Keep inside viewport boundaries
    const margin = 16
    left = Math.max(margin, Math.min(left, window.innerWidth - tooltipWidth - margin))
    top = Math.max(margin, Math.min(top, document.documentElement.scrollHeight - tooltipHeight - margin))

    setPlacement(targetPlacement)
    setPosition({ top, left })
  }, [coords, currentStep, paused])

  // SILENT TARGET LOADING: Return null if target is loading so tooltip remains invisible
  if (!activeTour || !currentStep || paused || (isLoadingTarget && currentStep.targetSelector)) return null

  const progressPercent = ((stepIndex + 1) / totalSteps) * 100

  const showHighlight = coords && isTargetVisible

  return (
    <AnimatePresence>
      {placement === 'center' ? (
        <>
          <div className="fixed inset-0 bg-background/40 backdrop-blur-[2px] pointer-events-auto z-[9998]" />

          <div className="fixed inset-0 flex items-center justify-center pointer-events-none z-[9999]">
            <motion.div
              ref={tooltipRef}
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className={cn(
                "pointer-events-auto flex flex-col w-[350px] max-w-[calc(100vw-2rem)]",
                "backdrop-blur-lg bg-background/80 dark:bg-card/75 border border-border/60 rounded-2xl shadow-xl p-5 overflow-hidden relative"
              )}
            >
              <div className="absolute top-0 left-0 w-full h-[3px] bg-muted">
                <motion.div
                  className="h-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>

              <div className="flex items-start justify-between gap-3">
                <h4 className="text-sm font-bold text-heading-text flex items-center gap-1.5">
                  {currentStep.icon && IconMap[currentStep.icon] ? (
                    React.createElement(IconMap[currentStep.icon] as React.ElementType, { className: "h-4 w-4 text-primary shrink-0" })
                  ) : (
                    stepIndex === 0 && <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  {currentStep.title}
                </h4>
                <button
                  onClick={skipTour}
                  className="text-muted-foreground hover:text-foreground hover:bg-muted/40 p-1 rounded-lg transition-colors shrink-0"
                  aria-label="Skip Tour"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mt-2.5 space-y-2">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {currentStep.content}
                </p>

                {currentStep.contrastMessage && (
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-primary leading-normal">
                    <strong>Contrast Check:</strong> {currentStep.contrastMessage}
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
                <span className="text-[10px] text-muted-foreground font-semibold">
                  Step {stepIndex + 1} of {totalSteps}
                </span>

                <div className="flex items-center gap-2">
                  {stepIndex > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={prevStep}
                      className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    >
                      <ArrowLeft className="h-3 w-3 mr-1" />
                      Back
                    </Button>
                  )}

                  {currentStep.actionType && currentStep.actionType !== 'none' ? (
                    <div className="text-[10px] text-primary font-semibold flex items-center gap-1 animate-pulse">
                      Waiting for action...
                    </div>
                  ) : stepIndex < totalSteps - 1 ? (
                    <Button
                      size="sm"
                      onClick={nextStep}
                      className="h-7 text-xs px-3 font-semibold shadow-sm"
                    >
                      Next
                      <ArrowRight className="h-3 w-3 ml-1" />
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={completeTour}
                      className="h-7 text-xs px-3 font-semibold bg-success hover:bg-success/90 text-success-foreground shadow-sm"
                    >
                      Got it
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        </>
      ) : (
        <div className="absolute inset-0 pointer-events-none z-[9999]">
          {showHighlight && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute rounded-lg border-2 border-primary/80 shadow-[0_0_15px_rgba(59,130,246,0.4)] pointer-events-none z-[9999]"
              style={{
                top: coords.top - 6,
                left: coords.left - 6,
                width: coords.width + 12,
                height: coords.height + 12,
              }}
              transition={{ type: 'spring', damping: 20 }}
            />
          )}

          <motion.div
            ref={tooltipRef}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className={cn(
              "pointer-events-auto z-[9999] flex flex-col w-[350px] max-w-[calc(100vw-2rem)]",
              "backdrop-blur-lg bg-background/80 dark:bg-card/75 border border-border/60 rounded-2xl shadow-xl p-5 overflow-hidden absolute"
            )}
            style={
              position
                ? {
                    top: position.top,
                    left: position.left,
                  } as any
                : undefined
            }
          >
            <div className="absolute top-0 left-0 w-full h-[3px] bg-muted">
              <motion.div
                className="h-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>

            <div className="flex items-start justify-between gap-3">
              <h4 className="text-sm font-bold text-heading-text flex items-center gap-1.5">
                {currentStep.icon && IconMap[currentStep.icon] ? (
                  React.createElement(IconMap[currentStep.icon] as React.ElementType, { className: "h-4 w-4 text-primary shrink-0" })
                ) : (
                  stepIndex === 0 && <Sparkles className="h-4 w-4 text-amber-500 shrink-0" />
                )}
                {currentStep.title}
              </h4>
              <button
                onClick={skipTour}
                className="text-muted-foreground hover:text-foreground hover:bg-muted/40 p-1 rounded-lg transition-colors shrink-0"
                aria-label="Skip Tour"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="mt-2.5 space-y-2">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {currentStep.content}
              </p>

              {currentStep.contrastMessage && (
                <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/10 text-[11px] text-primary leading-normal">
                  <strong>Contrast Check:</strong> {currentStep.contrastMessage}
                </div>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-border/40 pt-3">
              <span className="text-[10px] text-muted-foreground font-semibold">
                Step {stepIndex + 1} of {totalSteps}
              </span>

              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={prevStep}
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-3 w-3 mr-1" />
                    Back
                  </Button>
                )}

                {currentStep.actionType && currentStep.actionType !== 'none' ? (
                  <div className="text-[10px] text-primary font-semibold flex items-center gap-1 animate-pulse">
                    Waiting for action...
                  </div>
                ) : stepIndex < totalSteps - 1 ? (
                  <Button
                    size="sm"
                    onClick={nextStep}
                    className="h-7 text-xs px-3 font-semibold shadow-sm"
                  >
                    Next
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={completeTour}
                    className="h-7 text-xs px-3 font-semibold bg-success hover:bg-success/90 text-success-foreground shadow-sm"
                  >
                    Got it
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
