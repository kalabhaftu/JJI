'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { TrendingUp, BarChart3, Activity, Zap, Target } from 'lucide-react'

const tradingQuotes = [
  {
    text: "The goal is to make money, not to be right.",
    author: "Alexander Elder"
  },
  {
    text: "Risk comes from not knowing what you're doing.",
    author: "Warren Buffett"
  },
  {
    text: "In trading, you have to be defensive and aggressive at the same time.",
    author: "Ray Dalio"
  },
  {
    text: "The market is a device for transferring money from the impatient to the patient.",
    author: "Warren Buffett"
  },
  {
    text: "Cut your losses short and let your winners run.",
    author: "Trading Wisdom"
  },
  {
    text: "The trend is your friend until it ends.",
    author: "Trading Proverb"
  },
  {
    text: "Plan your trade and trade your plan.",
    author: "Trading Discipline"
  },
  {
    text: "Markets can remain irrational longer than you can remain solvent.",
    author: "John Maynard Keynes"
  },
  {
    text: "Trading is not about being right. It's about making money.",
    author: "Mark Douglas"
  },
  {
    text: "The most important thing in trading is capital preservation.",
    author: "Paul Tudor Jones"
  },
  {
    text: "Don't focus on making money. Focus on protecting what you have.",
    author: "Paul Tudor Jones"
  },
  {
    text: "Every battle is won before it is fought.",
    author: "Sun Tzu"
  },
  {
    text: "Successful trading is about probability, not certainty.",
    author: "Trading Wisdom"
  },
  {
    text: "The best traders have no ego.",
    author: "Mark Minervini"
  },
  {
    text: "Time is your friend; impulse is your enemy.",
    author: "Jack Bogle"
  }
]

const icons = [TrendingUp, BarChart3, TrendingUp, Activity, Zap, Target]

export function ImportLoading({ progress }: { progress?: number }) {
  const [currentQuoteIndex, setCurrentQuoteIndex] = useState(0)

  useEffect(() => {

    const quoteInterval = setInterval(() => {
      setCurrentQuoteIndex((prev) => (prev + 1) % tradingQuotes.length)
    }, 4000)

    return () => {
      clearInterval(quoteInterval)
    }
  }, [])

  const currentQuote = (tradingQuotes[currentQuoteIndex] || tradingQuotes[0]) || { text: "Importing...", author: "System" }
  const IconComponent = (icons[currentQuoteIndex % icons.length] || icons[0]) as React.ElementType

  return (
    <div className="flex flex-col items-center justify-center h-full w-full p-2 sm:p-4 lg:p-6 space-y-2 sm:space-y-3 lg:space-y-4 max-h-[80vh] overflow-hidden">
      <motion.div
        key={currentQuoteIndex}
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        exit={{ scale: 0, rotate: 180 }}
        transition={{
          type: "spring",
          stiffness: 260,
          damping: 20
        }}
        className="relative"
      >
        <div className="absolute inset-0 blur-lg opacity-40">
          <div className="w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-foreground/30 animate-pulse" />
        </div>
        <motion.div
          animate={{
            rotate: 360,
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear"
          }}
          className="relative z-10 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full bg-muted/20 border border-border flex items-center justify-center"
        >
          <IconComponent className="w-6 h-6 sm:w-8 sm:h-8 lg:w-10 lg:h-10 text-foreground" />
        </motion.div>
      </motion.div>

      <div className="space-y-0.5 sm:space-y-1 text-center">
        <motion.h3
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-lg sm:text-xl lg:text-2xl font-bold text-foreground"
        >
          Importing Your Trades
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-[10px] sm:text-xs lg:text-sm text-muted-foreground"
        >
          Analyzing and processing your trading data...
        </motion.p>
      </div>

      <div className="w-full max-w-xs sm:max-w-sm space-y-1">
        <div className="h-1 sm:h-1.5 bg-muted rounded-full overflow-hidden">
          {typeof progress === 'number' ? (
            <motion.div
              className="h-full bg-foreground"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
              transition={{ duration: 0.3 }}
            />
          ) : (
            <motion.div
              className="h-full bg-foreground"
              initial={{ x: '-100%' }}
              animate={{ x: '200%' }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
              style={{ width: '50%' }}
            />
          )}
        </div>
        <motion.p
          className="text-[10px] sm:text-xs text-center text-muted-foreground"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          {typeof progress === 'number' ? `${Math.round(progress)}% Complete` : 'Processing...'}
        </motion.p>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={currentQuoteIndex}
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.8 }}
          transition={{ duration: 0.5 }}
          className="hidden xl:block max-w-lg text-center space-y-1.5 relative px-4"
        >
          <div className="space-y-1 sm:space-y-1.5 max-w-[280px] sm:max-w-sm lg:max-w-md mx-auto relative z-10">
            <p className="text-sm sm:text-base lg:text-lg italic text-foreground/80 leading-relaxed font-medium">
              "{currentQuote?.text}"
            </p>
            <p className="text-xs sm:text-sm text-foreground/60 font-semibold tracking-wide uppercase">
              - {currentQuote?.author}
            </p>
          </div>
        </motion.div>
      </AnimatePresence>

      <div className="absolute inset-0 overflow-hidden pointer-events-none hidden lg:block">
        {[...Array(3)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-foreground/20"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
            }}
            animate={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
            }}
            transition={{
              duration: 10 + Math.random() * 10,
              repeat: Infinity,
              repeatType: "reverse",
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="flex items-center gap-1.5 sm:gap-2 text-[9px] sm:text-[10px] lg:text-xs text-muted-foreground"
      >
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          className="w-2.5 h-2.5 sm:w-3 sm:h-3 lg:w-4 lg:h-4 border-2 border-foreground border-t-transparent rounded-full flex-shrink-0"
        />
        <span className="hidden lg:inline">Checking for duplicates • Linking to account • Validating data</span>
        <span className="lg:hidden">Processing...</span>
      </motion.div>
    </div>
  )
}

