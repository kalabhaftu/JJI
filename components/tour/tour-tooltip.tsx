'use client'

import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { HugeiconsIcon } from '@hugeicons/react'
import { ArrowLeft01Icon, ArrowRight01Icon, Cancel01Icon, CircleCheckIcon, CompassIcon, FileSpreadsheetIcon, InformationCircleIcon, LayoutGridIcon, RefreshIcon, SparklesIcon } from '@hugeicons/core-free-icons'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useTour } from '@/context/tour-context'

const iconFor = (icon?: string) => {
  if (icon === 'import') return FileSpreadsheetIcon
  if (icon === 'navigation') return CompassIcon
  if (icon === 'layout') return LayoutGridIcon
  if (icon === 'check') return CircleCheckIcon
  return icon === 'info' ? InformationCircleIcon : SparklesIcon
}

export const TourTooltip: React.FC = () => {
  const {
    activeTour,
    stepIndex,
    currentStep,
    nextStep,
    prevStep,
    skipTour,
    isTargetVisible,
    isLoadingTarget,
    targetMissing,
    retryTarget,
    paused,
    totalSteps,
  } = useTour()
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null)

  useEffect(() => {
    if (!currentStep?.targetSelector || !isTargetVisible || paused) {
      setTargetRect(null)
      return
    }
    const update = () => {
      const element = document.querySelector(currentStep.targetSelector!)
      setTargetRect(element?.getBoundingClientRect() ?? null)
    }
    update()
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [currentStep?.targetSelector, isTargetVisible, paused])

  if (!activeTour || !currentStep || paused) return null

  const Icon = iconFor(currentStep.icon)
  const isNarrowViewport = typeof window !== 'undefined' && window.innerWidth < 768
  const centered = !targetRect || currentStep.placement === 'center' || isNarrowViewport || targetMissing
  const progress = totalSteps ? ((stepIndex + 1) / totalSteps) * 100 : 0
  const tooltipWidth = tooltipRef.current?.offsetWidth ?? 360
  const tooltipHeight = tooltipRef.current?.offsetHeight ?? 220
  const targetPlacement = currentStep.placement ?? 'bottom'
  const margin = 16
  const left = targetRect
    ? Math.max(margin, Math.min(
        targetPlacement === 'right'
          ? targetRect.right + 12
          : targetPlacement === 'left'
            ? targetRect.left - tooltipWidth - 12
            : targetRect.left + targetRect.width / 2 - tooltipWidth / 2,
        window.innerWidth - tooltipWidth - margin,
      ))
    : margin
  const top = targetRect
    ? Math.max(margin, Math.min(
        targetPlacement === 'top'
          ? targetRect.top - tooltipHeight - 12
          : targetPlacement === 'right' || targetPlacement === 'left'
            ? targetRect.top + targetRect.height / 2 - tooltipHeight / 2
            : targetRect.bottom + 12,
        window.innerHeight - tooltipHeight - margin,
      ))
    : margin

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9998] pointer-events-none" aria-live="polite">
        {targetRect && !centered && (
          <motion.div
            className="fixed rounded-lg border-2 border-primary shadow-[0_8px_24px_rgba(59,130,246,0.22)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              top: targetRect.top - 6,
              left: targetRect.left - 6,
              width: targetRect.width + 12,
              height: targetRect.height + 12,
            }}
          />
        )}
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, y: 8, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8 }}
          className={cn(
            'pointer-events-auto fixed w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-border bg-background shadow-2xl',
            centered && 'left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2',
          )}
          style={centered ? {} : { left, top }}
        >
          <div className="h-1 bg-muted"><motion.div className="h-full bg-primary" animate={{ width: `${progress}%` }} /></div>
          <div className="space-y-4 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <HugeiconsIcon icon={Icon} className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} color="currentColor" />
                <h2 className="text-base font-semibold text-heading-text">{currentStep.title}</h2>
              </div>
              <button type="button" onClick={() => void skipTour()} className="rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Skip tour">
                <HugeiconsIcon icon={Cancel01Icon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
              </button>
            </div>
            <p className="text-sm leading-6 text-muted-foreground">{currentStep.content}</p>
            {targetMissing && (
              <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-sm text-warning-foreground">
                This part is not available on the current screen. Retry after opening it, or skip this step.
              </div>
            )}
            {isLoadingTarget && (
              <p className="text-sm text-muted-foreground">Opening the right screen…</p>
            )}
            <div className="flex items-center justify-between border-t border-border pt-4">
              <span className="text-xs font-medium text-muted-foreground">Step {stepIndex + 1} of {totalSteps}</span>
              <div className="flex items-center gap-2">
                {stepIndex > 0 && <Button variant="tertiary" size="sm" onClick={prevStep}><HugeiconsIcon icon={ArrowLeft01Icon} className="mr-1 h-3.5 w-3.5" strokeWidth={2} color="currentColor" />Back</Button>}
                {targetMissing ? (
                  <>
                    <Button variant="secondary" size="sm" onClick={retryTarget}><HugeiconsIcon icon={RefreshIcon} className="mr-1 h-3.5 w-3.5" strokeWidth={2} color="currentColor" />Retry</Button>
                    <Button size="sm" onClick={nextStep}>Skip <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 h-3.5 w-3.5" strokeWidth={2} color="currentColor" /></Button>
                  </>
                ) : (currentStep.desktopOnly && isNarrowViewport) || !currentStep.completion || currentStep.completion.type === 'route' ? (
                  <Button size="sm" onClick={nextStep}>Next <HugeiconsIcon icon={ArrowRight01Icon} className="ml-1 h-3.5 w-3.5" strokeWidth={2} color="currentColor" /></Button>
                ) : (
                  <>
                    <span className="text-xs font-medium text-primary">Complete the highlighted action</span>
                    <Button variant="tertiary" size="sm" onClick={nextStep}>Skip step</Button>
                  </>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
