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
          "backdrop-blur-md bg-background/80 dark:bg-card/75 border border-border/80 rounded-full shadow-lg p-1.5 pl-4"
        )}
      >
        <span className="text-xs font-semibold text-muted-foreground mr-1">
          Tour paused
        </span>
        <button
          onClick={resumeTour}
          className={cn(
            "flex items-center justify-center gap-1.5 h-8 px-3 rounded-full text-xs font-bold",
            "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm transition-all duration-200"
          )}
        >
          <Play className="h-3 w-3 fill-current" />
          Resume Tour
        </button>
        <button
          onClick={skipTour}
          className={cn(
            "flex items-center justify-center h-8 w-8 rounded-full text-muted-foreground",
            "hover:text-foreground hover:bg-muted/40 transition-colors"
          )}
          aria-label="Cancel Tour"
        >
          <X className="h-4 w-4" />
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
