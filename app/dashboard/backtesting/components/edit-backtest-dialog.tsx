'use client'

import React, { useState, useEffect } from 'react'
import Image from 'next/image'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { LexicalEditor } from '@/components/ui/editor/lexical-editor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'
import { BacktestTrade, BacktestDirection, BacktestSession, BacktestModel, BacktestOutcome } from '@/types/backtesting-types'
import { Pencil as Edit, Camera, X, Target, Download } from "lucide-react"
import { formatTradePrice } from '@/lib/trading/precision'

const editBacktestSchema = z.object({
  notes: z.string().optional(),
  tags: z.string().optional(),
  model: z.enum(['ICT_2022', 'MSNR', 'TTFM', 'PRICE_ACTION', 'SUPPLY_DEMAND', 'SMART_MONEY', 'CUSTOM']),
  customModel: z.string().optional(),
})

type EditBacktestFormData = z.infer<typeof editBacktestSchema>

interface EditBacktestDialogProps {
  isOpen: boolean
  onClose: () => void
  backtest: BacktestTrade | null
  onSave: (updatedBacktest: Partial<BacktestTrade>) => Promise<void>
}

export function EditBacktestDialog({
  isOpen,
  onClose,
  backtest,
  onSave
}: EditBacktestDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [images, setImages] = useState<string[]>([])
  const [cardPreview, setCardPreview] = useState<string>('')
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors }
  } = useForm<EditBacktestFormData>({
    resolver: zodResolver(editBacktestSchema),
  })

  const watchedModel = watch('model')

  // Initialize form with backtest data and cleanup state
  useEffect(() => {
    if (backtest && isOpen) {
      reset({
        notes: backtest.notes || '',
        tags: backtest.tags?.join(', ') || '',
        model: backtest.model,
        customModel: backtest.customModel || '',
      })
      setImages(backtest.images || [])
      setCardPreview(backtest.cardPreviewImage || '')

      // CRITICAL FIX: Reset fullscreen image state when dialog opens
      setFullscreenImage(null)
    }

    // Cleanup when dialog closes
    if (!isOpen) {
      setFullscreenImage(null)
    }
  }, [backtest, isOpen, reset])

  const handleImageUpload = (file: File, isCardPreview: boolean = false) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (isCardPreview) {
        setCardPreview(result)
        toast.success('Card preview updated')
      } else {
        if (images.length < 6) {
          setImages(prev => [...prev, result])
          toast.success('Image added')
        } else {
          toast.error('Maximum 6 images allowed')
        }
      }
    }
    reader.readAsDataURL(file)
  }

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index))
  }

  const onSubmit = async (data: EditBacktestFormData) => {
    if (!backtest) return

    setIsSubmitting(true)
    try {
      const updateData = {
        notes: data.notes,
        tags: data.tags ? data.tags.split(',').map(t => t.trim()) : [],
        model: data.model,
        customModel: data.customModel,
        images,
        cardPreviewImage: cardPreview,
        updatedAt: new Date(),
      }

      await onSave(updateData as any)

      toast.success('Backtest updated', {
        description: 'Your backtest has been successfully updated.',
      })

      onClose()
    } catch (error) {
      reportClientError(error, { operation: 'update-backtest', route: '/dashboard/backtesting' })
      toast.error('Error', {
        description: error instanceof Error ? error.message : 'Failed to update backtest',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const [showCloseConfirm, setShowCloseConfirm] = useState(false)

  const handleCloseAttempt = (openState: boolean) => {
    if (!openState) {
      // Note: react-hook-form's isDirty isn't always reliable with complex objects or if fields are touched but value is same
      // But we can use it as a base. 
      // Also check if image count changed or preview changed
      // Simplified: we'll trust useForm's isDirty + check local state

      const hasUnsavedChanges = Object.keys(errors).length > 0 || // If errors, maybe they tried to submit changed data
        JSON.stringify(watch()) !== JSON.stringify({
          notes: backtest!.notes || '',
          tags: backtest!.tags?.join(', ') || '',
          model: backtest!.model,
          customModel: backtest!.customModel || '',
        }) ||
        images.length !== (backtest!.images?.length || 0) ||
        cardPreview !== (backtest!.cardPreviewImage || '')

      if (hasUnsavedChanges && !isSubmitting) {
        setShowCloseConfirm(true)
        return
      }
    }

    // Normal close
    onClose()
    reset()
    setFullscreenImage(null)
  }

  const handleConfirmClose = () => {
    setShowCloseConfirm(false)
    onClose()
    reset()
    setFullscreenImage(null) // Ensure this is cleared
  }

  if (!backtest) return null

  return (
    <>

      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Unsaved Changes</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes in your backtest editing. Are you sure you want to discard them?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep Editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="bg-destructive hover:bg-destructive/90">
              Discard Changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={isOpen} onOpenChange={handleCloseAttempt}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-5xl h-[90vh] max-h-[90vh] overflow-y-auto z-[10000] p-4 sm:p-6 bg-background border-border shadow-lg duration-200 flex flex-col gap-0">
          <DialogHeader>
            <DialogTitle className="flex items-center text-base sm:text-lg">
              <Edit className="w-4 h-4 sm:w-5 sm:h-5 mr-2" />
              Edit Backtest - {backtest.pair} {backtest.direction}
            </DialogTitle>
            <DialogDescription>
              Update your backtest analysis, notes, and supporting materials.
              Trade execution details are read-only.
            </DialogDescription>
          </DialogHeader>

          {/* Backtest Summary (Read-only) */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Backtest Summary (Read-only)</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 text-sm">
              <div>
                <Label className="text-sm text-muted-foreground">Pair</Label>
                <p className="font-medium">{backtest.pair}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Direction</Label>
                <p className="font-medium">{backtest.direction}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Outcome</Label>
                <p className={`font-bold ${backtest.outcome === 'WIN' ? 'text-long' : backtest.outcome === 'LOSS' ? 'text-short' : 'text-muted-foreground'}`}>
                  {backtest.outcome}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Points/Pips</Label>
                <p className={`font-bold ${backtest.pnl >= 0 ? 'text-long' : 'text-short'}`}>
                  {backtest.pnl >= 0 ? '+' : ''}{backtest.pnl.toFixed(2)}
                </p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Entry → Exit</Label>
                <p className="font-medium">{formatTradePrice(backtest.entryPrice, backtest.pair)} → {formatTradePrice(backtest.exitPrice, backtest.pair)}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">R:R Ratio</Label>
                <p className="font-medium">1:{backtest.riskRewardRatio.toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Session</Label>
                <p className="font-medium">{backtest.session}</p>
              </div>
              <div>
                <Label className="text-sm text-muted-foreground">Date</Label>
                <p className="font-medium">{new Date(backtest.dateExecuted).toLocaleDateString()}</p>
              </div>
            </CardContent>
          </Card>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Trading Model */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Trading Model
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Select Trading Model</Label>
                    <Select
                      value={watchedModel}
                      onValueChange={(value) => setValue('model', value as BacktestModel)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="ICT_2022">ICT 2022</SelectItem>
                        <SelectItem value="MSNR">MSNR</SelectItem>
                        <SelectItem value="TTFM">TTFM</SelectItem>
                        <SelectItem value="PRICE_ACTION">Price Action</SelectItem>
                        <SelectItem value="SUPPLY_DEMAND">Supply & Demand</SelectItem>
                        <SelectItem value="SMART_MONEY">Smart Money Concepts</SelectItem>
                        <SelectItem value="CUSTOM">Custom Model</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {watchedModel === 'CUSTOM' && (
                    <div className="space-y-2">
                      <Label htmlFor="customModel">Custom Model Name</Label>
                      <Input
                        id="customModel"
                        {...register('customModel')}
                        placeholder="Enter your custom model name"
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Backtest Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Backtest Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="notes">Analysis & Reflections</Label>
                  <Controller
                    control={control}
                    name="notes"
                    render={({ field }) => (
                      <LexicalEditor
                        placeholder="Add your backtest analysis and reflections..."
                        value={field.value || ''}
                        onChange={field.onChange}
                        minHeight="200px"
                      />
                    )}
                  />
                  <p className="text-sm text-muted-foreground">
                    Document your analysis, strategy validation, and lessons learned from this backtest.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Tags */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Tags</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input
                    id="tags"
                    {...register('tags')}
                    placeholder="fibonacci, liquidity sweep, fair value gap"
                  />
                  <p className="text-sm text-muted-foreground">
                    Use tags to organize and categorize your backtests
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Screenshots */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center">
                  <Camera className="w-5 h-5 mr-2" />
                  Screenshots & Images
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Card Preview First - Smaller Size */}
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Card Preview Image</Label>
                  <div className="w-full sm:w-64">
                    {cardPreview ? (
                      <div className="relative aspect-video group">
                        <Image
                          src={cardPreview}
                          alt="Card Preview"
                          fill
                          className="object-cover rounded cursor-pointer"
                          onClick={() => setFullscreenImage(cardPreview)}
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                          <Button
                            type="button"
                            variant="destructive"
                            size="sm"
                            onClick={() => setCardPreview('')}
                            className="mr-2"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setFullscreenImage(cardPreview)}
                          >
                            View
                          </Button>
                        </div>
                        <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium">
                          Preview
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed rounded-lg aspect-video flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0]
                            if (file) handleImageUpload(file, true)
                          }}
                        />
                        <div className="text-center">
                          <Camera className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Upload Card Preview</p>
                        </div>
                      </label>
                    )}
                  </div>
                </div>

                {/* Separator */}
                <div className="border-t pt-4">
                  <Label className="text-sm font-medium mb-3 block">Additional Screenshots (6 Slots)</Label>
                  {/* Images Grid - Always show 6 slots */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {Array.from({ length: 6 }).map((_, idx) => {
                      const hasImage = images[idx]

                      return (
                        <div key={idx} className="space-y-2">
                          <Label className="text-xs">Screenshot {idx + 1}</Label>
                          {hasImage ? (
                            <div className="relative aspect-video group">
                              <Image
                                src={images[idx]!}
                                alt={`Screenshot ${idx + 1}`}
                                fill
                                className="object-cover rounded cursor-pointer"
                                onClick={() => setFullscreenImage(images[idx]!)}
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center justify-center">
                                <Button
                                  type="button"
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => removeImage(idx)}
                                  className="mr-1"
                                >
                                  <X className="w-3 h-3" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="secondary"
                                  size="sm"
                                  onClick={() => setFullscreenImage(images[idx]!)}
                                >
                                  View
                                </Button>
                              </div>
                              <div className="absolute bottom-2 left-2 bg-black/60 text-white px-2 py-1 rounded text-xs">
                                #{idx + 1}
                              </div>
                            </div>
                          ) : (
                            <label className="border-2 border-dashed rounded-lg aspect-video flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                              <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) => {
                                  const file = e.target.files?.[0]
                                  if (file) handleImageUpload(file, false)
                                }}
                              />
                              <div className="text-center">
                                <Camera className="w-6 h-6 mx-auto mb-1 text-muted-foreground" />
                                <span className="text-xs text-muted-foreground">Upload</span>
                              </div>
                            </label>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                <p className="text-sm text-muted-foreground mt-2">
                  Upload chart screenshots, strategy setups, or analysis images (JPG, PNG, max 5MB each).
                </p>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex justify-end space-x-2">
              <Button type="button" variant="outline" onClick={() => handleCloseAttempt(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Viewer */}
      {fullscreenImage && (
        <div className="fixed inset-0 z-[10001] flex items-center justify-center bg-black/90 p-4" role="dialog" aria-modal="true" aria-label="Fullscreen backtest image">
          <button type="button" className="absolute inset-0" onClick={() => setFullscreenImage(null)} aria-label="Close fullscreen image" />
          <div className="pointer-events-none z-10 flex h-full w-full items-center justify-center">
            <Image
              src={fullscreenImage}
              alt="Fullscreen view"
              width={1200}
              height={800}
              className="max-w-full max-h-full object-contain"
            />
          </div>
          <div className="absolute right-4 top-4 z-20 flex gap-2">
            <Button
              variant="secondary"
              size="icon"
              className="bg-white/10 hover:bg-white/20"
              onClick={(e) => {
                e.stopPropagation()
                const link = document.createElement('a')
                link.href = fullscreenImage
                link.download = `backtest-${backtest?.pair || 'analysis'}-${Date.now()}.png`
                link.click()
              }}
              title="Download image"
            >
              <Download className="w-4 h-4" />
            </Button>
            <Button
              variant="destructive"
              size="icon"
              onClick={(e) => {
                e.stopPropagation()
                setFullscreenImage(null)
              }}
              title="Close"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  )
}
