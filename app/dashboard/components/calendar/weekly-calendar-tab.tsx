'use client'

import type { Dispatch, SetStateAction } from 'react'
import { Image as ImageIcon, Trash2, Upload, XCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { TabsContent } from '@/components/ui/tabs'
import type { WeeklyReviewData } from './weekly-modal-helpers'

type WeeklyCalendarTabProps = {
  reviewData: WeeklyReviewData | null
  setReviewData: Dispatch<SetStateAction<WeeklyReviewData | null>>
  imagePreview: string | null
  imageLoadError: boolean
  setImageLoadError: Dispatch<SetStateAction<boolean>>
  onRemoveImage: () => void
  onReplaceImage: () => void
}

export function WeeklyCalendarTab({
  reviewData,
  setReviewData,
  imagePreview,
  imageLoadError,
  setImageLoadError,
  onRemoveImage: handleRemoveImage,
  onReplaceImage: handleReplaceImage,
}: WeeklyCalendarTabProps) {
  return (
    <>
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
    </>
  )
}
