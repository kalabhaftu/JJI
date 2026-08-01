'use client'

import React from 'react'
import { useTour } from '@/context/tour-context'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const ResumeWidget: React.FC = () => {
  const { paused, resumeTour, skipTour, activeTour } = useTour()

  if (!paused || !activeTour) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50, scale: 0.9 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 50, scale: 0.9 }}
        className={cn(
          "fixed bottom-6 right-6 z-[9997] flex items-center gap-2",
          "bg-background/95 dark:bg-card/95 border border-border/80 rounded-lg shadow-lg p-1.5 pl-4"
        )}
      >
        <span className="text-xs font-semibold text-muted-foreground mr-1">
          Tour paused
        </span>
        <button
          type="button"
          onClick={resumeTour}
          className={cn(
            "flex min-h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-xs font-semibold",
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
        >
          <Play className="h-3 w-3 fill-current" />
          Resume Tour
        </button>
        <button
          type="button"
          onClick={skipTour}
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground",
            "hover:text-foreground hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          )}
          aria-label="Close paused tour"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
