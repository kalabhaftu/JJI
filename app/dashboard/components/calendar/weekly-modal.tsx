'use client'
import { Spinner } from '@/components/ui/spinner'
import type { TradeType } from '@/lib/db/schema/trades'

import { CalendarData } from "@/app/dashboard/types/calendar"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { LexicalEditor } from "@/components/ui/editor/lexical-editor"
import { dashboardModalShell } from '@/components/ui/dashboard-modal-shell'
import { useAuth } from "@/context/auth-provider"
import { useData } from '@/context/data-provider'
import { useTheme } from '@/context/theme-provider'
import { useSupabaseUpload } from "@/hooks/use-supabase-upload"
import { getTradingSession } from '@/lib/time-utils'
import { cn } from '@/lib/utils'
import {
  groupTradesByExecution,
  type GroupedTrade,
} from '@/lib/trading/trade-grouping'
import { classifyOutcome, getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { getTradeNetPnl } from '@/lib/metrics/pnl'
import { apiRequest } from '@/lib/api/client'
import { Calendar, BarChart3, CheckCircle2, Loader2, Clock, Image as ImageIcon, Percent, Activity, Target, Trash2, TrendingDown, TrendingUp, Upload, XCircle, Coins, ScrollText, AreaChart as AreaChartIcon, FileText, Sun, Moon, Boxes, Compass } from "lucide-react"

import imageCompression from 'browser-image-compression'
import { endOfWeek, format, parseISO, startOfWeek } from "date-fns"
import { enUS } from 'date-fns/locale'
import React, { useEffect, useMemo, useRef, useState } from "react"
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { toast } from "sonner"
import { useUserStore } from '@/store/user-store'

async function getWeeklyReview(startDate: Date) {
  const response = await apiRequest<any>(
    `/api/v1/weekly-journal?startDate=${encodeURIComponent(startDate.toISOString())}`,
  )
  return response.data
}

async function saveWeeklyReview(data: Record<string, unknown>) {
  try {
    const response = await apiRequest<any>('/api/v1/weekly-journal', {
      method: 'PUT',
      body: JSON.stringify(data),
    })
    return { success: true, data: response.data }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Failed to save review',
    }
  }
}

interface WeeklyModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  selectedDate: Date | null;
  calendarData: CalendarData;
  isLoading: boolean;
}

type WeeklyExpectation = 'BULLISH_EXPANSION' | 'BEARISH_EXPANSION' | 'CONSOLIDATION'

function weeklyReviewTextNode(text: string, format = 0) {
  return {
    detail: 0,
    format,
    mode: 'normal',
    style: '',
    text,
    type: 'text',
    version: 1,
  }
}

function weeklyReviewParagraph(text = '', format = 0) {
  return {
    children: [weeklyReviewTextNode(text, format)],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'paragraph',
    version: 1,
  }
}

function weeklyReviewHeading(text: string) {
  return {
    children: [weeklyReviewTextNode(text)],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'heading',
    tag: 'h3',
    version: 1,
  }
}

const WEEKLY_REVIEW_NOTES_TEMPLATE = JSON.stringify({
  root: {
    children: [
      weeklyReviewHeading('Weekly Review'),
      weeklyReviewParagraph('Follow the steps below to complete the weekly review', 1),
      weeklyReviewParagraph('1. Address questions for winning trades'),
      weeklyReviewParagraph('2. Address questions for losing trades'),
      weeklyReviewParagraph('3. Address questions for overall performance'),
      weeklyReviewParagraph(''),

      weeklyReviewHeading('Winning Trades'),
      weeklyReviewParagraph('Is this a trade you would take again without knowing the outcome was a win?', 1),
      weeklyReviewParagraph('Yes:', 1),
      weeklyReviewParagraph('What would you improve with your execution on this trade?'),
      weeklyReviewParagraph('How could you have managed this trade to increase the profit?'),
      weeklyReviewParagraph('What can you do to repeat this type of trade in the future?'),
      weeklyReviewParagraph('No:', 1),
      weeklyReviewParagraph('Where did you deviate from your plan or approach and why?'),
      weeklyReviewParagraph('How could this flawed win have been avoided in the future?'),
      weeklyReviewParagraph('What specifically was done incorrectly in this trade despite the outcome?'),
      weeklyReviewParagraph(''),

      weeklyReviewHeading('Losing Trades'),
      weeklyReviewParagraph('Is this a trade you would take again without knowing the outcome was a loss?', 1),
      weeklyReviewParagraph('Yes:', 1),
      weeklyReviewParagraph('Was there any logical way to avoid this loss in the moment?'),
      weeklyReviewParagraph('What specifically was done well in this trade despite the outcome?'),
      weeklyReviewParagraph('Were emotions controlled after this losing trade was realized?'),
      weeklyReviewParagraph('No:', 1),
      weeklyReviewParagraph('Where did you deviate from your plan or approach and why?'),
      weeklyReviewParagraph('What were the warning signs that led into this losing trade?'),
      weeklyReviewParagraph('How did you respond to the outcome of this trade and did it impact following trades?'),
      weeklyReviewParagraph(''),

      weeklyReviewHeading('Overall Performance'),
      weeklyReviewParagraph('Is there a valid trade that you missed in the past week?', 1),
      weeklyReviewParagraph('What was the reason for missing it and how can you get onside with a similar move in the future?'),
      weeklyReviewParagraph(''),
      weeklyReviewParagraph('What did you do this week that you did not do last week and how did it impact the outcome?', 1),
      weeklyReviewParagraph('Did you execute your process better this week in comparison to the previous week?'),
      weeklyReviewParagraph('Did results from the previous week impact your mindset this week either positively or negatively?'),
      weeklyReviewParagraph('What actions must be taken now to ensure improvement is made next week?'),
      weeklyReviewParagraph(''),
      weeklyReviewParagraph('Did you notice any repeating strengths which resulted in positive outcomes that you want to build on?', 1),
      weeklyReviewParagraph('Identify: What caused these positive decisions?'),
      weeklyReviewParagraph('Purpose: Why is it important to continue these strengths?'),
      weeklyReviewParagraph('Action: What are the steps to further improve them going forward?'),
      weeklyReviewParagraph(''),
      weeklyReviewParagraph('Did you notice any repeating mistakes which resulted in negative outcomes that you need to resolve?', 1),
      weeklyReviewParagraph('Identify: What caused these poor decisions?'),
      weeklyReviewParagraph('Purpose: Why is it important to remove these mistakes?'),
      weeklyReviewParagraph('Action: What are the steps to avoid them going forward?'),
    ],
    direction: 'ltr',
    format: '',
    indent: 0,
    type: 'root',
    version: 1,
  },
})

function MetricCard({
  icon: Icon,
  label,
  value,
  subValue,
  trend,
  className
}: {
  icon: any;
  label: string;
  value: string | number;
  subValue?: string;
  trend?: 'up' | 'down' | 'neutral';
  className?: string;
}) {
  const trendColor = trend === 'up' ? 'text-profit font-black' : trend === 'down' ? 'text-loss font-black' : 'text-foreground'
  const isLoss = trend === 'down'
  const isWin = trend === 'up'

  return (
    <div className={cn(
      "rounded-xl border border-border/30 bg-card/70 p-4 flex flex-col justify-between min-h-[100px] shadow-sm backdrop-blur-sm transition-all hover:bg-card/85",
      className
    )}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-[10px] uppercase font-extrabold tracking-wider text-muted-foreground/85">{label}</span>
        <span className={cn(
          "rounded-lg p-1.5 shrink-0",
          isWin && "bg-profit/10 text-profit",
          isLoss && "bg-loss/10 text-loss",
          !isWin && !isLoss && "bg-muted/30 text-muted-foreground"
        )}>
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div>
        <div className={cn("text-base sm:text-lg font-black tracking-tight font-mono", trendColor)}>
          {value}
        </div>
        {subValue && (
          <div className="text-[10px] text-muted-foreground/60 mt-1 font-semibold tracking-wide">{subValue}</div>
        )}
      </div>
    </div>
  )
}

export function WeeklyModal({
  isOpen,
  onOpenChange,
  selectedDate,
  calendarData,
  isLoading,
}: WeeklyModalProps) {
  const dateLocale = enUS
  const { user } = useAuth()
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const { statistics } = useData()
  const { chartStyle } = useTheme()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const [reviewData, setReviewData] = useState<any>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingReview, setIsLoadingReview] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [imageLoadError, setImageLoadError] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Track the latest save request to prevent race conditions
  const saveRequestRef = useRef<number>(0)
  // Track the latest reviewData to avoid stale values in rapid changes
  const reviewDataRef = useRef<any>(null)

  useEffect(() => {
    reviewDataRef.current = reviewData
  }, [reviewData])

  // Generate organized path: userId/week-start-date (YYYY-MM-DD)
  const weekStartDate = selectedDate ? format(startOfWeek(selectedDate), 'yyyy-MM-dd') : ''
  const uploadOwnerId = supabaseUser?.id
  const uploadPath = uploadOwnerId ? `${uploadOwnerId}/${weekStartDate}` : ''

  // Image upload setup - dedicated bucket for weekly calendars
  const { onUpload, files, setFiles, isSuccess: isUploadSuccess, loading: isUploading } = useSupabaseUpload({
    bucketName: 'weekly-calendars',
    path: uploadPath,
    allowedMimeTypes: ['image/*'],
    maxFiles: 1,
    upsert: true
  })

  useEffect(() => {
    // Validate selectedDate before opening
    if (isOpen && selectedDate && selectedDate instanceof Date && !isNaN(selectedDate.getTime())) {
      const loadReview = async () => {
        setIsLoadingReview(true)
        const data = await getWeeklyReview(selectedDate)
        setReviewData({
          ...(data ?? {}),
          notes: data?.notes && String(data.notes).trim().length > 0
            ? data.notes
            : WEEKLY_REVIEW_NOTES_TEMPLATE,
        })
        setIsLoadingReview(false)
      }
      loadReview()
    } else if (isOpen && (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime()))) {
      onOpenChange(false)
    }
  }, [isOpen, selectedDate, onOpenChange])

  // Aggregate weekly data
  const weeklyData = useMemo(() => {
    if (!selectedDate) return { trades: [], tradeNumber: 0, pnl: 0, longNumber: 0, shortNumber: 0, winRate: 0, avgWin: 0, avgLoss: 0, winningTrades: 0, losingTrades: 0 }

    const trades: any[] = []
    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 })

    // Format week boundaries as YYYY-MM-DD strings for consistent comparison
    // This avoids timezone issues when comparing against dateString keys
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    for (const [dateString, dayData] of Object.entries(calendarData)) {
      // Compare date strings directly to avoid timezone parsing issues
      if (dateString >= weekStartStr && dateString <= weekEndStr && dayData.trades) {
        trades.push(...(dayData.trades as any[]))
      }
    }

    // CRITICAL: Group trades to show correct execution count
    const groupedTrades = groupTradesByExecution(trades as TradeType[]) as GroupedTrade[]

    let longNumber = 0
    let shortNumber = 0
    let winningTrades = 0
    let losingTrades = 0
    let pnl = 0
    let winPnl = 0
    let lossPnl = 0

    for (const trade of groupedTrades) {
      const side = (trade as any).side
      const sideValue = typeof side === 'string' ? side.toLowerCase() : ''
      if (sideValue === 'long' || sideValue === 'buy') longNumber += 1
      if (sideValue === 'short' || sideValue === 'sell') shortNumber += 1

      const netPnl = getTradeNetPnl(trade)
      pnl += netPnl
      const outcome = classifyOutcome(netPnl, breakEvenThreshold)
      if (outcome === 'win') {
        winningTrades += 1
        winPnl += netPnl
      } else if (outcome === 'loss') {
        losingTrades += 1
        lossPnl += netPnl
      }
    }

    const winRate = (winningTrades + losingTrades) > 0 ? (winningTrades / (winningTrades + losingTrades)) * 100 : 0
    const avgWin = winningTrades > 0 ? winPnl / winningTrades : 0
    const avgLoss = losingTrades > 0 ? Math.abs(lossPnl) / losingTrades : 0

    return {
      trades: groupedTrades,
      tradeNumber: groupedTrades.length,
      pnl,
      longNumber,
      shortNumber,
      winRate,
      avgWin,
      avgLoss,
      winningTrades,
      losingTrades
    }
  }, [selectedDate, calendarData, breakEvenThreshold])

  const stats = useMemo(() => {
    if (weeklyData.trades.length === 0) return null

    const dayStats: Record<string, { pnl: number; trades: number }> = {}
    const pairStats: Record<string, { pnl: number; trades: number; wins: number }> = {}
    const sessionStats: Record<string, { pnl: number; trades: number }> = {}
    let grossProfit = 0
    let grossLoss = 0

    weeklyData.trades.forEach((trade: any) => {
      // Day Stats
      const day = format(new Date(trade.entryDate), 'EEEE')
      const netPnL = getTradeNetPnl(trade)
      if (!dayStats[day]) dayStats[day] = { pnl: 0, trades: 0 }
      dayStats[day].pnl += netPnL
      dayStats[day].trades += 1

      // Pair Stats
      const pair = trade.instrument || 'Unknown'
      if (!pairStats[pair]) pairStats[pair] = { pnl: 0, trades: 0, wins: 0 }
      pairStats[pair].pnl += netPnL
      pairStats[pair].trades += 1
      if (classifyOutcome(netPnL, breakEvenThreshold) === 'win') pairStats[pair].wins += 1

      // Session Stats (proper timezone handling)
      const session = getTradingSession(trade.entryDate)
      if (!sessionStats[session]) sessionStats[session] = { pnl: 0, trades: 0 }
      sessionStats[session].pnl += netPnL
      sessionStats[session].trades += 1

      const outcome = classifyOutcome(netPnL, breakEvenThreshold)
      if (outcome === 'win') grossProfit += netPnL
      if (outcome === 'loss') grossLoss += netPnL
    })

    const sortedDays = Object.entries(dayStats).sort((a, b) => b[1].pnl - a[1].pnl)
    const sortedPairs = Object.entries(pairStats).sort((a, b) => b[1].pnl - a[1].pnl)
    const sortedSessions = Object.entries(sessionStats).sort((a, b) => b[1].pnl - a[1].pnl)

    const absoluteGrossLoss = Math.abs(grossLoss)
    const profitFactor = absoluteGrossLoss > 0 ? grossProfit / absoluteGrossLoss : grossProfit > 0 ? Infinity : 0

    return {
      bestDay: sortedDays[0],
      worstDay: sortedDays[sortedDays.length - 1],
      bestPair: sortedPairs[0],
      worstPair: sortedPairs[sortedPairs.length - 1],
      bestSession: sortedSessions[0],
      dayStats,
      pairStats: sortedPairs,
      sessionStats: sortedSessions,
      profitFactor,
      grossProfit,
      grossLoss: absoluteGrossLoss
    }
  }, [weeklyData, breakEvenThreshold])

  // Chart data for cumulative P&L
  const chartData = useMemo(() => {
    if (!selectedDate) return []

    const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
    const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 })

    // Format week boundaries as YYYY-MM-DD strings for consistent comparison
    const weekStartStr = format(weekStart, 'yyyy-MM-dd')
    const weekEndStr = format(weekEnd, 'yyyy-MM-dd')

    const dailyData: Record<string, number> = {}
    for (const [dateString, dayData] of Object.entries(calendarData)) {
      // Compare date strings directly to avoid timezone parsing issues
      if (dateString >= weekStartStr && dateString <= weekEndStr) {
        dailyData[dateString] = dayData.pnl || 0
      }
    }

    const sortedDates = Object.keys(dailyData).sort()
    let cumulative = 0

    return sortedDates.map((date) => {
      cumulative += dailyData[date] ?? 0
      return {
        date,
        balance: cumulative,
        daily: dailyData[date],
        // Use parseISO to treat YYYY-MM-DD as local midnight, avoiding timezone shifts
        label: format(parseISO(date), 'EEE', { locale: enUS })
      }
    })
  }, [selectedDate, calendarData])

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const loadingToast = toast.loading("Compressing image...")

      // Compress image to WebP
      const options = {
        maxSizeMB: 1,
        maxWidthOrHeight: 1920,
        useWebWorker: true,
        fileType: 'image/webp'
      }

      const compressedFile = await imageCompression(file, options)
      const newFile = new File([compressedFile], `weekly-calendar-${Date.now()}.webp`, { type: 'image/webp' })

      // Create preview URL from the compressed file
      const preview = URL.createObjectURL(compressedFile)
      setImagePreview(preview)
      setUploadedFile(newFile)

      // Prepare file for upload hook
      const fileWithPreview = Object.assign(newFile, {
        preview: preview,
        errors: []
      })
      setFiles([fileWithPreview as any])

      toast.dismiss(loadingToast)
      toast.success("Image prepared. Click Save to upload.")

    } catch (error) {
      toast.error("Failed to process image")
    }
  }

  // Handle Image Removal
  const handleRemoveImage = () => {
    // Clear preview
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }
    setUploadedFile(null)
    setFiles([])

    // Clear the saved image from review data
    setReviewData({ ...reviewData, calendarImage: null })
    toast.info("Image removed")
  }

  const handleReplaceImage = () => {
    // Clear current preview
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview)
      setImagePreview(null)
    }
    setUploadedFile(null)
    setFiles([])

    // Trigger file input
    const fileInput = document.getElementById('weekly-calendar-upload') as HTMLInputElement
    if (fileInput) {
      fileInput.value = ''
      fileInput.click()
    }
  }

  // Cleanup preview URL when modal closes or unmounts
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
    }
  }, [imagePreview])

  // Reset preview when modal closes
  useEffect(() => {
    if (!isOpen) {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview)
      }
      setImagePreview(null)
      setUploadedFile(null)
      setFiles([])
      setImageLoadError(false)
      setActiveTab('overview')
    }
  }, [isOpen, imagePreview, setFiles])

  // Safe Close Logic
  const [showUnsavedAlert, setShowUnsavedAlert] = useState(false)
  // Track the exact data state as confirmed by the server (initially or after save)
  const lastSavedReviewData = useRef<any>(null)

  // Update baseline when data is loaded (only if we haven't tracked it yet to avoid resetting on re-renders)
  useEffect(() => {
    if (reviewData && !isLoadingReview && !lastSavedReviewData.current) {
      lastSavedReviewData.current = JSON.parse(JSON.stringify(reviewData))
    }
  }, [reviewData, isLoadingReview])

  const handleCloseAttempt = (open: boolean) => {
    if (!open) {
      if (!reviewData) {
        onOpenChange(false)
        return
      }

      // We only care about user-editable fields
      const current = reviewData
      const saved = lastSavedReviewData.current || {}

      const hasChanges =
        (current.notes || '') !== (saved.notes || '') ||
        (current.actualOutcome || '') !== (saved.actualOutcome || '') ||
        (current.isCorrect !== saved.isCorrect) ||
        // Check image: logic handles both URL strings (saved) and nulls
        (current.calendarImage !== saved.calendarImage)

      // Note: Expectation is auto-saved, so we don't block on it (refer to auto-save logic)

      if (hasChanges) {
        setShowUnsavedAlert(true)
      } else {
        onOpenChange(false)
      }
    } else {
      onOpenChange(true)
    }
  }

  // Update handleSave to update baseline
  const handleSave = async () => {
    if (!selectedDate) return
    setIsSaving(true)

    try {
      let imageUrl = reviewData?.calendarImage

      // Upload new image if exists
      if (uploadedFile && files.length > 0) {
        if (!uploadOwnerId) throw new Error('Upload session is not available')
        const uploadResult = await onUpload()
        if (uploadResult.errors.length > 0 || !uploadResult.successfulNames.includes(files[0]!.name)) {
          throw new Error(uploadResult.errors[0]?.message || 'Calendar image upload failed')
        }
        // Construct public URL for weekly-calendars bucket with organized path
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        if (supabaseUrl) {
          const objectPath = `${uploadOwnerId}/${weekStartDate}/${files[0]!.name}`
            .split('/')
            .map(encodeURIComponent)
            .join('/')
          imageUrl = `${supabaseUrl}/storage/v1/object/public/weekly-calendars/${objectPath}`
        }
      }

      const result = await saveWeeklyReview({
        startDate: startOfWeek(selectedDate, { weekStartsOn: 0 }),
        endDate: endOfWeek(selectedDate, { weekStartsOn: 0 }),
        calendarImage: imageUrl,
        expectation: reviewData?.expectation,
        actualOutcome: reviewData?.actualOutcome,
        isCorrect: reviewData?.isCorrect,
        notes: reviewData?.notes
      })

      if (result.success) {
        setReviewData(result.data)
        // CRITICAL: Update baseline after successful save
        lastSavedReviewData.current = JSON.parse(JSON.stringify(result.data))

        toast.success("Weekly review saved")

        // Clear upload state after successful save
        if (imagePreview) {
          URL.revokeObjectURL(imagePreview)
          setImagePreview(null)
        }
        setUploadedFile(null)
        setFiles([])

        // Close modal after successful save
        onOpenChange(false)
      } else {
        toast.error("Failed to save review")
      }
    } catch (error) {
      toast.error("An error occurred while saving")
    } finally {
      setIsSaving(false)
    }
  }

  // Also need to update baseline when Expectation auto-saves
  // We can modify the auto-save logic in the RadioGroup onValueChange

  if (!selectedDate || !isOpen) return null;

  const weekStart = startOfWeek(selectedDate, { weekStartsOn: 0 })
  const weekEnd = endOfWeek(selectedDate, { weekStartsOn: 0 })
  const dateRange = `${format(weekStart, 'MMM d', { locale: dateLocale })} - ${format(weekEnd, 'MMM d, yyyy', { locale: dateLocale })}`

  return (
    <>
      <Dialog open={isOpen} onOpenChange={handleCloseAttempt}>
        <DialogContent className={dashboardModalShell.weekly}>
          <DialogTitle className="sr-only">Weekly Review for {dateRange}</DialogTitle>

          {/* Hidden file input for replacement */}
          <input
            id="weekly-calendar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImageUpload}
          />

          {/* Header */}
          <div className="shrink-0 px-5 py-4 sm:px-6 border-b border-border/40 bg-background/95">
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/50 bg-muted/25 text-muted-foreground">
                  <Calendar className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-lg font-semibold tracking-tight sm:text-xl">{dateRange}</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">Weekly Performance Review</p>
                </div>
              </div>
              <Button onClick={handleSave} disabled={isSaving || isUploading} className="shrink-0 rounded-xl px-4">
                {isSaving || isUploading ? <Spinner className="mr-2 h-4 w-4" /> : null}
                Save Review
              </Button>
            </div>
          </div>

          {/* Tabs Navigation */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 sm:px-6 py-3 border-b border-border/40 bg-background">
              <TabsList className="h-auto w-full flex-wrap justify-start rounded-xl border border-border/40 bg-muted/20 p-1 gap-1">
                <TabsTrigger
                  value="overview"
                  className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="analysis"
                  className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Analysis
                </TabsTrigger>
                <TabsTrigger
                  value="calendar"
                  className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Calendar Image
                </TabsTrigger>
                <TabsTrigger
                  value="notes"
                  className="rounded-xl px-4 py-2.5 data-[state=active]:bg-background data-[state=active]:shadow-sm"
                >
                  Notes
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Overview Tab */}
              <TabsContent value="overview" className="m-0 px-4 py-5 sm:px-6 lg:px-8 space-y-6">
                {/* Key Metrics Grid */}
                <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4">
                  <MetricCard
                    icon={Coins}
                    label="Total P&L"
                    value={`$${weeklyData.pnl.toFixed(2)}`}
                    trend={weeklyData.pnl > 0 ? 'up' : weeklyData.pnl < 0 ? 'down' : 'neutral'}
                  />
                  <MetricCard
                    icon={ScrollText}
                    label="Trades"
                    value={weeklyData.tradeNumber}
                    subValue={`${weeklyData.longNumber}L / ${weeklyData.shortNumber}S`}
                  />
                  <MetricCard
                    icon={Percent}
                    label="Win Rate"
                    value={`${weeklyData.winRate.toFixed(1)}%`}
                    subValue={`${weeklyData.winningTrades}W / ${weeklyData.losingTrades}L`}
                    trend={weeklyData.winRate >= 50 ? 'up' : 'down'}
                  />
                  <MetricCard
                    icon={TrendingUp}
                    label="Avg Win"
                    value={`$${weeklyData.avgWin.toFixed(2)}`}
                    trend="up"
                  />
                  <MetricCard
                    icon={TrendingDown}
                    label="Avg Loss"
                    value={`$${weeklyData.avgLoss.toFixed(2)}`}
                    trend="down"
                  />
                  <MetricCard
                    icon={Activity}
                    label="Profit Factor"
                    value={stats?.profitFactor === Infinity ? '∞' : stats?.profitFactor?.toFixed(2) || '0.00'}
                    trend={stats && stats.profitFactor >= 1 ? 'up' : 'down'}
                  />
                </div>

                {/* Chart Section */}
                <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <AreaChartIcon className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium">Cumulative P&L</h3>
                  </div>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData} margin={{ left: 0, right: 0, top: 10, bottom: 5 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} vertical={false} />
                        <XAxis
                          dataKey="label"
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                          tickFormatter={(value) => `$${value >= 1000 || value <= -1000 ? (value / 1000).toFixed(1) + 'k' : value.toFixed(0)}`}
                          width={50}
                        />
                        <Tooltip
                          content={({ active, payload }: any) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload
                              return (
                                <div className="rounded-lg border border-border/50 bg-card p-3 shadow-md">
                                  <div className="text-xs text-muted-foreground mb-1">
                                    {format(new Date(data.date + 'T00:00:00Z'), 'EEEE, MMM d', { locale: enUS })}
                                  </div>
                                  <div className="flex flex-col gap-1">
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Daily: </span>
                                      <span className={cn("font-semibold", data.daily >= 0 ? 'text-long' : 'text-short')}>
                                        ${data.daily?.toFixed(2)}
                                      </span>
                                    </div>
                                    <div className="text-sm">
                                      <span className="text-muted-foreground">Cumulative: </span>
                                      <span className={cn("font-semibold", data.balance >= 0 ? 'text-long' : 'text-short')}>
                                        ${data.balance?.toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="3 3" opacity={0.5} />
                        <Area
                          type={chartStyle === 'sharp' ? 'linear' : 'monotone'}
                          dataKey="balance"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="hsl(var(--primary))"
                          fillOpacity={0.12}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Performance Highlights Grid */}
                {stats && (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-border/25 border border-border/30 bg-card/45 rounded-xl overflow-hidden">
                    <div className="p-4.5 bg-card/35 flex flex-col justify-between min-h-[96px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Sun className="h-4 w-4 text-long" />
                        <span className="text-xs font-semibold text-muted-foreground/80">Best Day</span>
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold truncate">
                          {stats.bestDay ? stats.bestDay[0] : 'N/A'}
                        </div>
                        <div className="text-xs text-long mt-0.5 font-semibold font-mono">
                          {stats.bestDay ? `+$${stats.bestDay[1].pnl.toFixed(2)}` : '$0.00'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4.5 bg-card/35 flex flex-col justify-between min-h-[96px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Moon className="h-4 w-4 text-short" />
                        <span className="text-xs font-semibold text-muted-foreground/80">Worst Day</span>
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold truncate">
                          {stats.worstDay ? stats.worstDay[0] : 'N/A'}
                        </div>
                        <div className="text-xs text-short mt-0.5 font-semibold font-mono">
                          {stats.worstDay ? `$${stats.worstDay[1].pnl.toFixed(2)}` : '$0.00'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4.5 bg-card/35 flex flex-col justify-between min-h-[96px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Boxes className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground/80">Top Instrument</span>
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold truncate">
                          {stats.bestPair ? stats.bestPair[0] : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground/60 mt-0.5 font-medium font-mono">
                          {stats.bestPair ? `$${stats.bestPair[1].pnl.toFixed(2)} (${stats.bestPair[1].trades} trades)` : '0 trades'}
                        </div>
                      </div>
                    </div>

                    <div className="p-4.5 bg-card/35 flex flex-col justify-between min-h-[96px]">
                      <div className="flex items-center gap-2 mb-2">
                        <Clock className="h-4 w-4 text-primary" />
                        <span className="text-xs font-semibold text-muted-foreground/80">Best Session</span>
                      </div>
                      <div>
                        <div className="text-sm sm:text-base font-bold truncate">
                          {stats.bestSession ? stats.bestSession[0] : 'N/A'}
                        </div>
                        <div className="text-xs text-muted-foreground/60 mt-0.5 font-medium font-mono">
                          {stats.bestSession ? `$${stats.bestSession[1].pnl.toFixed(2)} (${stats.bestSession[1].trades} trades)` : '0 trades'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Analysis Tab */}
              <TabsContent value="analysis" className="m-0 px-4 py-5 sm:px-6 lg:px-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Weekly Expectation */}
                  <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Compass className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">Weekly Expectation</h3>
                    </div>
                    <RadioGroup
                      value={reviewData?.expectation || ''}
                      onValueChange={(val) => {
                        if (!selectedDate) return

                        // Create updated review data object with new expectation
                        // This ensures we use the latest values, not stale closure values
                        const updatedReviewData = {
                          ...(reviewData || {}),
                          expectation: val as WeeklyExpectation
                        }

                        // Update local state immediately for instant feedback
                        setReviewData(updatedReviewData)

                        // Auto-save expectation immediately for better UX
                        // Use a request counter to prevent race conditions
                        const currentRequest = ++saveRequestRef.current
                        const savedExpectation = val as WeeklyExpectation
                        const saveExpectation = async () => {
                          try {
                            // Read latest state from ref to avoid stale values from rapid changes
                            // This ensures we always save the most current state, not the state at change time
                            const latestReviewData = reviewDataRef.current

                            const result = await saveWeeklyReview({
                              startDate: startOfWeek(selectedDate),
                              endDate: endOfWeek(selectedDate),
                              expectation: savedExpectation, // Use the saved expectation value
                              actualOutcome: latestReviewData?.actualOutcome,
                              isCorrect: latestReviewData?.isCorrect,
                              notes: latestReviewData?.notes,
                              calendarImage: latestReviewData?.calendarImage
                            })

                            // Only update state if this is still the latest request
                            // This prevents older saves from overwriting newer selections
                            if (result.success && result.data && currentRequest === saveRequestRef.current) {
                              const savedData = result.data

                              // CRITICAL: Update baseline since we successfully auto-saved
                              // This ensures checking for dirty state later works correctly
                              if (lastSavedReviewData.current) {
                                lastSavedReviewData.current = JSON.parse(JSON.stringify(savedData))
                              }

                              // Merge server response with current state to preserve concurrent local changes
                              // Only update the field that was auto-saved (expectation), preserve other local changes
                              setReviewData((prev: any) => {
                                  if (!prev) {
                                    // If no previous state, use server response
                                    return { ...savedData, expectation: savedExpectation }
                                  }

                                  // Merge: use server data as base, but preserve local changes for non-saved fields
                                  return {
                                    ...savedData,
                                    expectation: savedExpectation, // Always use the saved value
                                    // Preserve local changes if they exist in prev (including falsy values)
                                    actualOutcome: 'actualOutcome' in prev ? prev.actualOutcome : (savedData?.actualOutcome ?? undefined),
                                    isCorrect: 'isCorrect' in prev ? prev.isCorrect : (savedData?.isCorrect ?? undefined),
                                    notes: 'notes' in prev ? prev.notes : (savedData?.notes ?? undefined),
                                    calendarImage: 'calendarImage' in prev ? prev.calendarImage : (savedData?.calendarImage ?? undefined)
                                  }
                                })
                              }
                            } catch (error) {
                              // Silent fail - will be saved when user clicks save button
                            }
                          }
                          saveExpectation()
                        }}
                        className="space-y-3"
                      >
                        <label className={cn(
                          "relative flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          reviewData?.expectation === 'BULLISH_EXPANSION'
                            ? "border-long bg-long/10 shadow-sm ring-1 ring-long/20"
                            : "border-border hover:border-long/50 hover:bg-muted/30"
                        )}>
                          <RadioGroupItem value="BULLISH_EXPANSION" id="bullish" className="sr-only" />
                          <div className={cn(
                            "p-2 rounded-lg transition-all",
                            reviewData?.expectation === 'BULLISH_EXPANSION'
                              ? "bg-long/20"
                              : "bg-long/10"
                          )}>
                            <TrendingUp className="h-4 w-4 text-long" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Bullish Expansion</div>
                            <div className="text-xs text-muted-foreground">Expecting upward price movement</div>
                          </div>
                          {reviewData?.expectation === 'BULLISH_EXPANSION' && (
                            <CheckCircle2 className="h-5 w-5 text-long" />
                          )}
                        </label>

                        <label className={cn(
                          "relative flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          reviewData?.expectation === 'BEARISH_EXPANSION'
                            ? "border-short bg-short/10 shadow-sm ring-1 ring-short/20"
                            : "border-border hover:border-short/50 hover:bg-muted/30"
                        )}>
                          <RadioGroupItem value="BEARISH_EXPANSION" id="bearish" className="sr-only" />
                          <div className={cn(
                            "p-2 rounded-lg transition-all",
                            reviewData?.expectation === 'BEARISH_EXPANSION'
                              ? "bg-short/20"
                              : "bg-short/10"
                          )}>
                            <TrendingDown className="h-4 w-4 text-short" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Bearish Expansion</div>
                            <div className="text-xs text-muted-foreground">Expecting downward price movement</div>
                          </div>
                          {reviewData?.expectation === 'BEARISH_EXPANSION' && (
                            <CheckCircle2 className="h-5 w-5 text-short" />
                          )}
                        </label>

                        <label className={cn(
                          "relative flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-all",
                          reviewData?.expectation === 'CONSOLIDATION'
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20"
                            : "border-border hover:border-primary/50 hover:bg-muted/30"
                        )}>
                          <RadioGroupItem value="CONSOLIDATION" id="consolidation" className="sr-only" />
                          <div className={cn(
                            "p-2 rounded-lg transition-all",
                            reviewData?.expectation === 'CONSOLIDATION'
                              ? "bg-primary/20"
                              : "bg-primary/10"
                          )}>
                            <Activity className="h-4 w-4 text-primary" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Consolidation</div>
                            <div className="text-xs text-muted-foreground">Expecting range-bound movement</div>
                          </div>
                          {reviewData?.expectation === 'CONSOLIDATION' && (
                            <CheckCircle2 className="h-5 w-5 text-primary" />
                          )}
                        </label>
                      </RadioGroup>
                    </div>

                  {/* Actual Outcome */}
                  <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <Target className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">Actual Outcome</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Was expectation correct?</Label>
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant={reviewData?.isCorrect === true ? "default" : "outline"}
                            className={cn(
                              "flex-1 h-12 rounded-xl border border-border/40",
                              reviewData?.isCorrect === true && "bg-long hover:bg-long/90 border-long text-white"
                            )}
                            onClick={() => setReviewData({ ...reviewData, isCorrect: true })}
                          >
                            <CheckCircle2 className="mr-2 h-4 w-4" />
                            Correct
                          </Button>
                          <Button
                            type="button"
                            variant={reviewData?.isCorrect === false ? "destructive" : "outline"}
                            className={cn(
                              "flex-1 h-12 rounded-xl border border-border/40",
                              reviewData?.isCorrect === false && "bg-short hover:bg-short/90 border-short text-white"
                            )}
                            onClick={() => setReviewData({ ...reviewData, isCorrect: false })}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Incorrect
                          </Button>
                        </div>
                      </div>

                      <Separator className="bg-border/30" />

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Actual Market Behavior</Label>
                        <Select
                          value={reviewData?.actualOutcome || ''}
                          onValueChange={(val) => setReviewData({ ...reviewData, actualOutcome: val })}
                        >
                          <SelectTrigger className="h-12 rounded-xl border border-border/40 bg-card/45">
                            <SelectValue placeholder="Select actual outcome" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border border-border/40">
                            <SelectItem value="BULLISH_EXPANSION">
                              <div className="flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-long" />
                                Bullish Expansion
                              </div>
                            </SelectItem>
                            <SelectItem value="BEARISH_EXPANSION">
                              <div className="flex items-center gap-2">
                                <TrendingDown className="h-4 w-4 text-short" />
                                Bearish Expansion
                              </div>
                            </SelectItem>
                            <SelectItem value="CONSOLIDATION">
                              <div className="flex items-center gap-2">
                                <Activity className="h-4 w-4 text-primary" />
                                Consolidation
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Instrument Breakdown */}
                {stats && stats.pairStats.length > 0 && (
                  <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <BarChart3 className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">Instrument Breakdown</h3>
                    </div>
                    <div className="space-y-2">
                      {stats.pairStats.map(([pair, data]) => (
                        <div key={pair} className="flex items-center justify-between p-3 rounded-xl border border-border/20 bg-card/35">
                          <div className="flex items-center gap-3">
                            <div className="font-medium text-sm">{pair}</div>
                            <Badge variant="secondary" className="text-[10px] rounded-md px-1.5 py-0.5 bg-muted/50 border border-border/30">
                              {data.trades} trades
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4">
                            <span className="text-xs text-muted-foreground/85">
                              {((data.wins / data.trades) * 100).toFixed(0)}% WR
                            </span>
                            <span className={cn(
                              "font-semibold font-mono text-sm",
                              data.pnl >= 0 ? 'text-long' : 'text-short'
                            )}>
                              {data.pnl >= 0 ? '+' : ''}${data.pnl.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </TabsContent>

              {/* Calendar Image Tab */}
              <TabsContent value="calendar" className="m-0 px-4 py-5 sm:px-6 lg:px-8">
                <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-2">
                      <ImageIcon className="h-4 w-4 text-primary" />
                      <h3 className="text-sm font-medium">Economic Calendar Screenshot</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {(reviewData?.calendarImage || imagePreview) && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 rounded-lg text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={handleRemoveImage}
                            aria-label="Remove screenshot"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-3 rounded-lg border border-border/30 hover:bg-muted/35"
                            onClick={handleReplaceImage}
                          >
                            <Upload className="h-4 w-4 mr-1.5" />
                            Replace
                          </Button>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="border border-border/30 rounded-xl overflow-hidden bg-card/20 relative min-h-[400px] flex items-center justify-center">
                    {(imagePreview || reviewData?.calendarImage) && !imageLoadError ? (
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={imagePreview || reviewData?.calendarImage}
                          alt="Economic Calendar"
                          className="w-full h-full object-contain max-h-[500px] rounded-lg"
                          onError={(e) => {
                            setImageLoadError(true)
                            toast.error("Failed to load saved image. Please upload a new one.")
                          }}
                        />
                        {imagePreview && (
                          <div className="absolute top-6 left-6">
                            <Badge className="bg-primary text-primary-foreground border-none">
                              New Upload (Click Save)
                            </Badge>
                          </div>
                        )}
                      </div>
                    ) : imageLoadError ? (
                      <div className="flex flex-col items-center justify-center text-muted-foreground py-12">
                        <XCircle className="h-12 w-12 text-destructive mb-4" />
                        <p className="text-sm font-medium mb-2">Failed to load saved image</p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-xl border border-border/40"
                          onClick={() => {
                            setImageLoadError(false)
                            setReviewData({ ...reviewData, calendarImage: null })
                            document.getElementById('weekly-calendar-upload')?.click()
                          }}
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Upload New Image
                        </Button>
                      </div>
                    ) : (
                      <label
                        htmlFor="weekly-calendar-upload"
                        className="flex flex-col items-center justify-center text-muted-foreground py-16 cursor-pointer hover:bg-muted/30 transition-colors w-full h-full"
                      >
                        <div className="p-4 rounded-xl border border-border/40 bg-muted/20 mb-4">
                          <ImageIcon className="h-8 w-8 opacity-50" />
                        </div>
                        <span className="text-sm font-medium mb-1">Upload weekly calendar screenshot</span>
                        <span className="text-xs opacity-70">Click to browse or drag and drop</span>
                        <span className="text-xs opacity-50 mt-2">Supports: JPG, PNG, WebP (Max 1MB)</span>
                      </label>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Notes Tab */}
              <TabsContent value="notes" className="m-0 px-4 py-5 sm:px-6 lg:px-8">
                <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <FileText className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-medium">Weekly Review Notes</h3>
                  </div>
                  <div className="space-y-3">
                    <LexicalEditor
                      placeholder="Answer each prompt directly under the question."
                      minHeight="420px"
                      value={reviewData?.notes || ''}
                      onChange={(val) => setReviewData({ ...reviewData, notes: val })}
                    />
                    <p className="text-xs text-muted-foreground/70">
                      Complete each section with your answers so your weekly review stays consistent.
                    </p>
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showUnsavedAlert} onOpenChange={setShowUnsavedAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in your weekly review. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setShowUnsavedAlert(false)
                // Reset to baseline derived from lastSavedReviewData
                if (lastSavedReviewData.current) {
                  setReviewData(JSON.parse(JSON.stringify(lastSavedReviewData.current)))
                }
                onOpenChange(false)
              }}
              className="bg-destructive hover:bg-destructive/90"
            >
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
