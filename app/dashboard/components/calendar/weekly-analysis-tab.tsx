'use client'

import type { Dispatch, MutableRefObject, SetStateAction } from 'react'
import { endOfWeek, startOfWeek } from 'date-fns'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  Activity01Icon,
  BarChartIcon,
  CheckmarkCircle01Icon,
  Compass01Icon,
  Target01Icon,
  ChartDecreaseIcon,
  ChartIncreaseIcon,
  CancelCircleIcon,
} from '@hugeicons/core-free-icons'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { TabsContent } from '@/components/ui/tabs'
import { reportError } from '@/lib/observability/report-error'
import { cn } from '@/lib/utils'
import { saveWeeklyReview, type WeeklyExpectation, type WeeklyReviewData } from './weekly-modal-helpers'
import type { WeeklyModalMetrics } from './use-weekly-modal-metrics'

type WeeklyAnalysisTabProps = {
  selectedDate: Date
  reviewData: WeeklyReviewData | null
  setReviewData: Dispatch<SetStateAction<WeeklyReviewData | null>>
  saveRequestRef: MutableRefObject<number>
  reviewDataRef: MutableRefObject<WeeklyReviewData | null>
  lastSavedReviewData: MutableRefObject<WeeklyReviewData | null>
  stats: WeeklyModalMetrics['stats']
}

export function WeeklyAnalysisTab({
  selectedDate,
  reviewData,
  setReviewData,
  saveRequestRef,
  reviewDataRef,
  lastSavedReviewData,
  stats,
}: WeeklyAnalysisTabProps) {
  return (
    <>
{}
              <TabsContent value="analysis" className="m-0 px-4 py-5 sm:px-6 lg:px-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {}
                  <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <HugeiconsIcon icon={Compass01Icon} className="h-4 w-4 text-primary" strokeWidth={2} color="currentColor" />
                      <h3 className="text-sm font-medium">Weekly Expectation</h3>
                    </div>
                    <RadioGroup
                      value={reviewData?.expectation || ''}
                      onValueChange={(val) => {
                        if (!selectedDate) return


                        const updatedReviewData = {
                          ...(reviewData || {}),
                          expectation: val as WeeklyExpectation
                        }


                        setReviewData(updatedReviewData)


                        const currentRequest = ++saveRequestRef.current
                        const savedExpectation = val as WeeklyExpectation
                        const saveExpectation = async () => {
                          try {


                            const latestReviewData = reviewDataRef.current

                            const result = await saveWeeklyReview({
                              startDate: startOfWeek(selectedDate),
                              endDate: endOfWeek(selectedDate),
                              expectation: savedExpectation,
                              actualOutcome: latestReviewData?.actualOutcome,
                              isCorrect: latestReviewData?.isCorrect,
                              notes: latestReviewData?.notes,
                              calendarImage: latestReviewData?.calendarImage
                            })


                            if (result.success && result.data && currentRequest === saveRequestRef.current) {
                              const savedData = result.data


                              if (lastSavedReviewData.current) {
                                lastSavedReviewData.current = JSON.parse(JSON.stringify(savedData))
                              }


                              setReviewData((prev) => {
                                  if (!prev) {

                                    return { ...savedData, expectation: savedExpectation }
                                  }


                                  return {
                                    ...savedData,
                                    expectation: savedExpectation,

                                    actualOutcome: 'actualOutcome' in prev ? (prev.actualOutcome ?? null) : (savedData.actualOutcome ?? null),
                                    isCorrect: 'isCorrect' in prev ? (prev.isCorrect ?? null) : (savedData.isCorrect ?? null),
                                    notes: 'notes' in prev ? (prev.notes ?? null) : (savedData.notes ?? null),
                                    calendarImage: 'calendarImage' in prev ? (prev.calendarImage ?? null) : (savedData.calendarImage ?? null)
                                  }
                                })
                              }
                            } catch (error) {
                              reportError(error, {
                                surface: 'client',
                                operation: 'auto-save-weekly-expectation',
                                route: '/dashboard',
                              })

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
                            <HugeiconsIcon icon={ChartIncreaseIcon} className="h-4 w-4 text-long" strokeWidth={2} color="currentColor" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Bullish Expansion</div>
                            <div className="text-xs text-muted-foreground">Expecting upward price movement</div>
                          </div>
                          {reviewData?.expectation === 'BULLISH_EXPANSION' && (
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5 text-long" strokeWidth={2} color="currentColor" />
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
                            <HugeiconsIcon icon={ChartDecreaseIcon} className="h-4 w-4 text-short" strokeWidth={2} color="currentColor" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Bearish Expansion</div>
                            <div className="text-xs text-muted-foreground">Expecting downward price movement</div>
                          </div>
                          {reviewData?.expectation === 'BEARISH_EXPANSION' && (
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5 text-short" strokeWidth={2} color="currentColor" />
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
                            <HugeiconsIcon icon={Activity01Icon} className="h-4 w-4 text-primary" strokeWidth={2} color="currentColor" />
                          </div>
                          <div className="flex-1">
                            <div className="font-medium">Consolidation</div>
                            <div className="text-xs text-muted-foreground">Expecting range-bound movement</div>
                          </div>
                          {reviewData?.expectation === 'CONSOLIDATION' && (
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="h-5 w-5 text-primary" strokeWidth={2} color="currentColor" />
                          )}
                        </label>
                      </RadioGroup>
                    </div>

                  {}
                  <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <HugeiconsIcon icon={Target01Icon} className="h-4 w-4 text-primary" strokeWidth={2} color="currentColor" />
                      <h3 className="text-sm font-medium">Actual Outcome</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Was expectation correct?</Label>
                        <div className="flex gap-3">
                          <Button
                            type="button"
                            variant={reviewData?.isCorrect === true ? "primary" : "secondary"}
                            className={cn(
                              "flex-1 h-12 rounded-xl border border-border/40",
                              reviewData?.isCorrect === true && "bg-long hover:bg-long/90 border-long text-white"
                            )}
                            onClick={() => setReviewData({ ...reviewData, isCorrect: true })}
                          >
                            <HugeiconsIcon icon={CheckmarkCircle01Icon} className="mr-2 h-4 w-4" strokeWidth={2} color="currentColor" />
                            Correct
                          </Button>
                          <Button
                            type="button"
                            variant={reviewData?.isCorrect === false ? "destructive" : "secondary"}
                            className={cn(
                              "flex-1 h-12 rounded-xl border border-border/40",
                              reviewData?.isCorrect === false && "bg-short hover:bg-short/90 border-short text-white"
                            )}
                            onClick={() => setReviewData({ ...reviewData, isCorrect: false })}
                          >
                            <HugeiconsIcon icon={CancelCircleIcon} className="mr-2 h-4 w-4" strokeWidth={2} color="currentColor" />
                            Incorrect
                          </Button>
                        </div>
                      </div>

                      <Separator className="bg-border/30" />

                      <div className="space-y-2">
                        <Label className="text-xs text-muted-foreground">Actual Market Behavior</Label>
                        <Select
                          value={reviewData?.actualOutcome || ''}
                          onValueChange={(val) => setReviewData({ ...reviewData, actualOutcome: val as WeeklyExpectation })}
                        >
                          <SelectTrigger className="h-12 rounded-xl border border-border/40 bg-card/45">
                            <SelectValue placeholder="Select actual outcome" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl border border-border/40">
                            <SelectItem value="BULLISH_EXPANSION">
                              <div className="flex items-center gap-2">
                                <HugeiconsIcon icon={ChartIncreaseIcon} className="h-4 w-4 text-long" strokeWidth={2} color="currentColor" />
                                Bullish Expansion
                              </div>
                            </SelectItem>
                            <SelectItem value="BEARISH_EXPANSION">
                              <div className="flex items-center gap-2">
                                <HugeiconsIcon icon={ChartDecreaseIcon} className="h-4 w-4 text-short" strokeWidth={2} color="currentColor" />
                                Bearish Expansion
                              </div>
                            </SelectItem>
                            <SelectItem value="CONSOLIDATION">
                              <div className="flex items-center gap-2">
                                <HugeiconsIcon icon={Activity01Icon} className="h-4 w-4 text-primary" strokeWidth={2} color="currentColor" />
                                Consolidation
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  </div>
                </div>

                {}
                {stats && stats.pairStats.length > 0 && (
                  <div className="rounded-xl border border-border/30 bg-muted/5 p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <HugeiconsIcon icon={BarChartIcon} className="h-4 w-4 text-primary" strokeWidth={2} color="currentColor" />
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
    </>
  )
}
