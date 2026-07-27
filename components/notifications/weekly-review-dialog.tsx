'use client'

import { useEffect, useState } from 'react'
import * as Sentry from '@sentry/nextjs'
import { format } from 'date-fns'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Spinner } from '@/components/ui/spinner'
import {
  AlertTriangle,
  BarChart3,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { dashboardModalShell } from '@/components/ui/dashboard-modal-shell'

interface WeeklyAIReview {
  id: string
  weekStart: string
  weekEnd: string
  summary: string
  highlights: string[]
  lowlights: string[]
  stats: {
    totalTrades: number
    winRate: number
    totalPnl: number
    profitFactor: number
    wins: number
    losses: number
    avgWin: number
    avgLoss: number
    bestDay: { day: string; pnl: number; trades: number } | null
    worstDay: { day: string; pnl: number; trades: number } | null
    avgTradesPerDay: number
    tradingDays: number
    maxWinStreak: number
    maxLossStreak: number
    instruments: { name: string; pnl: number; trades: number; winRate: number }[]
  }
  grade: string
  focusNextWeek: string | null
  createdAt: string
}

interface WeeklyReviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  reviewId?: string | undefined
}

const gradeColors: Record<string, string> = {
  'A+': 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  A: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
  'B+': 'bg-green-500/15 text-green-400 border-green-500/25',
  B: 'bg-green-500/10 text-green-400 border-green-500/20',
  'C+': 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25',
  C: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
  D: 'bg-orange-500/15 text-orange-400 border-orange-500/25',
  F: 'bg-red-500/15 text-red-400 border-red-500/25',
}

export function WeeklyReviewDialog({ open, onOpenChange, reviewId }: WeeklyReviewDialogProps) {
  const [reviews, setReviews] = useState<WeeklyAIReview[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!open) return

    const fetchReviews = async () => {
      setIsLoading(true)

      try {
        const query = new URLSearchParams({ limit: '20' })
        if (reviewId) {
          query.set('reviewId', reviewId)
        }

        const res = await fetch(`/api/v1/weekly-review?${query.toString()}`)
        const result = await res.json()

        if (result.success) {
          const reviewList = (Array.isArray(result.data) ? result.data : [result.data]).filter(Boolean)
          setReviews(reviewList)

          if (reviewId) {
            const idx = reviewList.findIndex((review: WeeklyAIReview) => review.id === reviewId)
            setCurrentIndex(idx >= 0 ? idx : 0)
          } else {
            setCurrentIndex(0)
          }
        } else {
          setReviews([])
        }
      } catch (error) {
        Sentry.captureException(error, { extra: { route: 'components/notifications/weekly-review-dialog' } })
        setReviews([])
      } finally {
        setIsLoading(false)
      }
    }

    fetchReviews()
  }, [open, reviewId])

  const review = reviews[currentIndex]
  const canGoPrev = currentIndex > 0
  const canGoNext = currentIndex < reviews.length - 1

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={dashboardModalShell.weekly}>
        <DialogHeader className="sr-only">
          <DialogTitle>Weekly Performance Review</DialogTitle>
          <DialogDescription>
            Review weekly performance summaries, highlights, lowlights, and focus areas.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center p-16">
            <Spinner className="h-6 w-6" />
          </div>
        ) : !review ? (
          <div className="flex flex-col items-center justify-center p-16 text-muted-foreground">
            <BarChart3 className="mb-3 h-10 w-10 opacity-50" />
            <p className="text-sm">No weekly reviews yet.</p>
            <p className="mt-1 text-xs">Reviews are generated automatically each weekend.</p>
          </div>
        ) : (
          <>
            <div className="px-6 pb-4 pt-6">
              <DialogHeader>
                <div className="flex items-center justify-between gap-4">
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5" />
                    Weekly Performance Review
                  </DialogTitle>
                  {review.grade && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'border px-4 py-1 text-xl font-bold',
                        gradeColors[review.grade] || 'bg-muted text-muted-foreground'
                      )}
                    >
                      {review.grade}
                    </Badge>
                  )}
                </div>
                <DialogDescription className="mt-1 flex items-center gap-1.5">
                  <Calendar className="h-3.5 w-3.5" />
                  {format(new Date(review.weekStart), 'MMM d')} - {format(new Date(review.weekEnd), 'MMM d, yyyy')}
                </DialogDescription>
              </DialogHeader>
            </div>

            <ScrollArea className="max-h-[calc(85vh-140px)]">
              <div className="space-y-5 px-6 pb-6">
                <div className="grid grid-cols-4 gap-3">
                  <StatCard
                    label="Trades"
                    value={String(review.stats.totalTrades)}
                    sub={`${review.stats.tradingDays} days`}
                  />
                  <StatCard
                    label="Win Rate"
                    value={`${review.stats.winRate}%`}
                    sub={`${review.stats.wins}W / ${review.stats.losses}L`}
                    color={review.stats.winRate >= 50 ? 'text-long' : 'text-short'}
                  />
                  <StatCard
                    label="P&L"
                    value={`$${review.stats.totalPnl.toLocaleString()}`}
                    color={review.stats.totalPnl >= 0 ? 'text-long' : 'text-short'}
                  />
                  <StatCard
                    label="Profit Factor"
                    value={review.stats.profitFactor >= 999 ? 'Infinity' : String(review.stats.profitFactor)}
                    color={
                      review.stats.profitFactor >= 1.5
                        ? 'text-long'
                        : review.stats.profitFactor >= 1
                          ? 'text-muted-foreground'
                          : 'text-short'
                    }
                  />
                </div>

                <div>
                  <p className="text-sm leading-relaxed text-foreground/90">{review.summary}</p>
                </div>

                <Separator />

                {review.highlights.length > 0 && (
                  <div>
                    <h4 className="mb-2.5 flex items-center gap-2 text-sm font-medium">
                      <TrendingUp className="h-4 w-4 text-long" />
                      What Went Well
                    </h4>
                    <ul className="space-y-2">
                      {review.highlights.map((highlight, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-foreground/80">
                          <Trophy className="mt-0.5 h-3.5 w-3.5 shrink-0 text-long" />
                          {highlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {review.lowlights.length > 0 && (
                  <div>
                    <h4 className="mb-2.5 flex items-center gap-2 text-sm font-medium">
                      <TrendingDown className="h-4 w-4 text-short" />
                      What Needs Work
                    </h4>
                    <ul className="space-y-2">
                      {review.lowlights.map((lowlight, index) => (
                        <li key={index} className="flex items-start gap-2 text-sm text-foreground/80">
                          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-short" />
                          {lowlight}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {review.focusNextWeek && (
                  <>
                    <Separator />
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
                      <h4 className="mb-2 flex items-center gap-2 text-sm font-medium">
                        <Target className="h-4 w-4 text-primary" />
                        Focus Next Week
                      </h4>
                      <p className="text-sm text-foreground/80">{review.focusNextWeek}</p>
                    </div>
                  </>
                )}

                {review.stats.instruments.length > 0 && (
                  <>
                    <Separator />
                    <div>
                      <h4 className="mb-2.5 text-sm font-medium">Instruments</h4>
                      <div className="space-y-1.5">
                        {review.stats.instruments.map((instrument) => (
                          <div key={instrument.name} className="flex items-center justify-between text-sm">
                            <span className="font-medium">{instrument.name}</span>
                            <div className="flex items-center gap-3 text-xs text-muted-foreground">
                              <span>{instrument.trades} trades</span>
                              <span>{instrument.winRate}% WR</span>
                              <span
                                className={cn(
                                  'font-medium',
                                  instrument.pnl >= 0 ? 'text-long' : 'text-short'
                                )}
                              >
                                ${instrument.pnl.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>

            {reviews.length > 1 && (
              <div className="flex items-center justify-between border-t px-6 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex((index) => index + 1)}
                  disabled={!canGoNext}
                >
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Older
                </Button>
                <span className="text-xs text-muted-foreground">
                  {currentIndex + 1} of {reviews.length} reports
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setCurrentIndex((index) => index - 1)}
                  disabled={!canGoPrev}
                >
                  Newer
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-lg border bg-card p-3 text-center">
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className={cn('text-lg font-bold', color)}>{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p> : null}
    </div>
  )
}
