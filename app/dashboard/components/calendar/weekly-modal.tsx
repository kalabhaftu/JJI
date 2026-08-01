'use client'

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
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { dashboardModalShell } from '@/components/ui/dashboard-modal-shell'
import { Spinner } from '@/components/ui/spinner'
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useData } from '@/context/data-provider'
import { useTheme } from '@/context/theme-provider'
import { useSupabaseUpload } from "@/hooks/use-supabase-upload"
import { getBreakEvenThreshold } from '@/lib/metrics/outcome'
import { reportError } from '@/lib/observability/report-error'
import { Calendar } from "lucide-react"

import imageCompression from 'browser-image-compression'
import { endOfWeek, format, startOfWeek } from "date-fns"
import { enUS } from 'date-fns/locale'
import { type ChangeEvent, useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { useUserStore } from '@/store/user-store'

import {
  getWeeklyReview,
  saveWeeklyReview,
  WEEKLY_REVIEW_NOTES_TEMPLATE,
  type WeeklyModalProps,
  type WeeklyReviewData,
} from '@/app/dashboard/components/calendar/weekly-modal-helpers'
import { useWeeklyModalMetrics } from './use-weekly-modal-metrics'
import { WeeklyAnalysisTab } from './weekly-analysis-tab'
import { WeeklyCalendarTab } from './weekly-calendar-tab'
import { WeeklyNotesTab } from './weekly-notes-tab'
import { WeeklyOverviewTab } from './weekly-overview-tab'

export function WeeklyModal({
  isOpen,
  onOpenChange,
  selectedDate,
  calendarData,
}: WeeklyModalProps) {
  const dateLocale = enUS
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const { statistics } = useData()
  const { chartStyle } = useTheme()
  const breakEvenThreshold = getBreakEvenThreshold(statistics?.breakEvenThreshold)
  const [reviewData, setReviewData] = useState<WeeklyReviewData | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isLoadingReview, setIsLoadingReview] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadedFile, setUploadedFile] = useState<File | null>(null)
  const [imageLoadError, setImageLoadError] = useState(false)
  const [activeTab, setActiveTab] = useState('overview')

  // Track the latest save request to prevent race conditions
  const saveRequestRef = useRef<number>(0)
  // Track the latest reviewData to avoid stale values in rapid changes
  const reviewDataRef = useRef<WeeklyReviewData | null>(null)

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
        try {
          const data = await getWeeklyReview(selectedDate)
          setReviewData({
            ...(data ?? {}),
            notes: data?.notes && String(data.notes).trim().length > 0
              ? data.notes
              : WEEKLY_REVIEW_NOTES_TEMPLATE,
          })
        } catch (error) {
          reportError(error, {
            surface: 'client',
            operation: 'load-weekly-review',
            route: '/dashboard',
          })
          toast.error('Failed to load weekly review')
        } finally {
          setIsLoadingReview(false)
        }
      }
      loadReview()
    } else if (isOpen && (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime()))) {
      onOpenChange(false)
    }
  }, [isOpen, selectedDate, onOpenChange])

  const { weeklyData, stats, chartData } = useWeeklyModalMetrics({
    selectedDate,
    calendarData,
    breakEvenThreshold,
  })

  const handleImageUpload = async (e: ChangeEvent<HTMLInputElement>) => {
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
      reportError(error, {
        surface: 'client',
        operation: 'prepare-weekly-calendar-image',
        route: '/dashboard',
      })
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
  const lastSavedReviewData = useRef<WeeklyReviewData | null>(null)

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
        reportError(new Error(result.error || 'Failed to save review'), {
          surface: 'client',
          operation: 'save-weekly-review',
          route: '/dashboard',
        })
        toast.error("Failed to save review")
      }
    } catch (error) {
      reportError(error, {
        surface: 'client',
        operation: 'save-weekly-review',
        route: '/dashboard',
      })
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
              <WeeklyOverviewTab
                weeklyData={weeklyData}
                stats={stats}
                chartData={chartData}
                chartStyle={chartStyle}
              />
              <WeeklyAnalysisTab
                selectedDate={selectedDate}
                reviewData={reviewData}
                setReviewData={setReviewData}
                saveRequestRef={saveRequestRef}
                reviewDataRef={reviewDataRef}
                lastSavedReviewData={lastSavedReviewData}
                stats={stats}
              />
              <WeeklyCalendarTab
                reviewData={reviewData}
                setReviewData={setReviewData}
                imagePreview={imagePreview}
                imageLoadError={imageLoadError}
                setImageLoadError={setImageLoadError}
                onRemoveImage={handleRemoveImage}
                onReplaceImage={handleReplaceImage}
              />
              <WeeklyNotesTab reviewData={reviewData} setReviewData={setReviewData} />
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
