'use client'

import type { Dispatch, SetStateAction } from 'react'
import { HugeiconsIcon } from '@hugeicons/react'
import { File01Icon } from '@hugeicons/core-free-icons'
import { LexicalEditor } from '@/components/ui/editor/lexical-editor'
import { TabsContent } from '@/components/ui/tabs'
import type { WeeklyReviewData } from './weekly-modal-helpers'

type WeeklyNotesTabProps = {
  reviewData: WeeklyReviewData | null
  setReviewData: Dispatch<SetStateAction<WeeklyReviewData | null>>
}

export function WeeklyNotesTab({ reviewData, setReviewData }: WeeklyNotesTabProps) {
  return (
    <>
{}
              <TabsContent value="notes" className="m-0 px-4 py-5 sm:px-6 lg:px-8">
                <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <HugeiconsIcon icon={File01Icon} className="h-4 w-4 text-primary" strokeWidth={1.5} color="currentColor" />
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
    </>
  )
}
