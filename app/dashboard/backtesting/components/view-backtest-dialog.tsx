'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Eye, TrendingUp as TrendUp, Clock, Target, Download } from "lucide-react"
import { cn } from '@/lib/utils'
import { formatTradePrice } from '@/lib/trading/precision'
import { BacktestTrade } from '@/types/backtesting-types'

interface ViewBacktestDialogProps {
  isOpen: boolean
  onClose: () => void
  backtest: BacktestTrade | null
}

export function ViewBacktestDialog({ isOpen, onClose, backtest }: ViewBacktestDialogProps) {
  const [selectedImage, setSelectedImage] = useState<string | null>(null)

  if (!backtest) return null

  const allImages = [...(backtest.images || []), backtest.cardPreviewImage].filter(Boolean) as string[]

  const formatSession = (session: string) => {
    return session.split('_').map(word =>
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ')
  }

  const formatModel = (model: string, customModel?: string) => {
    if (model === 'CUSTOM' && customModel) return customModel
    return model.replace(/_/g, ' ')
  }

  const formatDate = (dateString: Date) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="w-full max-w-[95vw] sm:max-w-5xl h-[90vh] max-h-[90vh] overflow-y-auto p-4 sm:p-6 bg-background border-border shadow-lg duration-200 flex flex-col gap-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Eye className="w-4 h-4 sm:w-5 sm:h-5" />
              Backtest Details - {backtest.pair} {backtest.direction}
            </DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Comprehensive view of backtest execution, analysis, and supporting materials.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
            {                                 }
            <div className="lg:col-span-2 space-y-6">
              {                       }
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendUp className="w-5 h-5" />
                    Execution Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 sm:gap-4 text-sm">
                  <div>
                    <Label className="text-sm text-muted-foreground">Pair / Instrument</Label>
                    <p className="font-medium text-lg">{backtest.pair}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Direction</Label>
                    <Badge variant={backtest.direction === 'BUY' ? 'default' : 'secondary'}>
                      {backtest.direction}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Outcome</Label>
                    <Badge variant={
                      backtest.outcome === 'WIN' ? 'default' :
                        backtest.outcome === 'LOSS' ? 'destructive' :
                          'outline'
                    }>
                      {backtest.outcome}
                    </Badge>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Entry Price</Label>
                    <p className="font-medium">{formatTradePrice(backtest.entryPrice, backtest.pair)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Exit Price</Label>
                    <p className="font-medium">{formatTradePrice(backtest.exitPrice, backtest.pair)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">P&L</Label>
                    <p className={cn(
                      "font-bold text-lg",
                      backtest.pnl >= 0 ? 'text-long' : 'text-short'
                    )}>
                      ${backtest.pnl.toFixed(2)}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {                     }
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Target className="w-5 h-5" />
                    Risk Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Stop Loss</Label>
                    <p className="font-medium text-foreground">{backtest.stopLoss.toFixed(5)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Take Profit</Label>
                    <p className="font-medium text-foreground">{backtest.takeProfit.toFixed(5)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Risk:Reward Ratio</Label>
                    <p className="font-bold text-lg">1:{backtest.riskRewardRatio.toFixed(2)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Price Movement</Label>
                    <p className="font-medium">
                      {((backtest.exitPrice - backtest.entryPrice) / backtest.entryPrice * 100).toFixed(2)}%
                    </p>
                  </div>
                </CardContent>
              </Card>

              {                                }
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Strategy & Session Details
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm text-muted-foreground">Trading Session</Label>
                    <p className="font-medium">{formatSession(backtest.session)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Trading Model</Label>
                    <p className="font-medium">{formatModel(backtest.model, backtest.customModel)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Execution Date</Label>
                    <p className="font-medium">{formatDate(backtest.dateExecuted)}</p>
                  </div>
                  <div>
                    <Label className="text-sm text-muted-foreground">Backtest Date</Label>
                    <p className="font-medium">
                      {backtest.backtestDate ? formatDate(backtest.backtestDate) : 'N/A'}
                    </p>
                  </div>
                </CardContent>
              </Card>

              {                       }
              {backtest.notes && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Backtest Analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="prose prose-sm max-w-none whitespace-pre-wrap">
                      {backtest.notes}
                    </div>
                  </CardContent>
                </Card>
              )}

              {          }
              {backtest.tags && backtest.tags.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Tags</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {backtest.tags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary">
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {                                     }
            <div className="space-y-6">
              {allImages.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Screenshots ({allImages.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {allImages.map((image, index) => {
                        const isPreview = image === backtest.cardPreviewImage
                        return (
                          <div key={index} className="relative group">
                            <button
                              type="button"
                              className="aspect-video relative rounded-lg overflow-hidden cursor-pointer border-2 border-transparent hover:border-primary transition-colors"
                              onClick={() => setSelectedImage(image)}
                              aria-label={`Open ${isPreview ? 'card preview' : `screenshot ${index + 1}`}`}
                            >
                              <Image
                                src={image}
                                alt={isPreview ? 'Card Preview' : `Screenshot ${index + 1}`}
                                fill
                                className="object-cover"
                              />
                              <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Eye className="w-8 h-8 text-white" />
                              </div>
                            </button>
                            <p className="text-xs text-muted-foreground mt-1 text-center">
                              {isPreview ? 'Card Preview' : `Screenshot ${index + 1}`}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {                         }
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendUp className="w-5 h-5" />
                    Key Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Win/Loss</span>
                    <Badge variant={
                      backtest.outcome === 'WIN' ? 'default' :
                        backtest.outcome === 'LOSS' ? 'destructive' :
                          'outline'
                    }>
                      {backtest.outcome}
                    </Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Points/Pips</span>
                    <span className={cn(
                      "font-medium",
                      backtest.pnl >= 0 ? 'text-long' : 'text-short'
                    )}>
                      {backtest.pnl >= 0 ? '+' : ''}{backtest.pnl.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Risk:Reward</span>
                    <span className="font-medium">
                      1:{backtest.riskRewardRatio.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Points Captured</span>
                    <span className="font-medium">
                      {Math.abs(backtest.exitPrice - backtest.entryPrice).toFixed(5)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">% Move</span>
                    <span className={cn(
                      "font-medium",
                      backtest.pnl >= 0 ? 'text-long' : 'text-short'
                    )}>
                      {((backtest.exitPrice - backtest.entryPrice) / backtest.entryPrice * 100).toFixed(2)}%
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {                        }
      {selectedImage && (
        <Dialog open={!!selectedImage} onOpenChange={() => setSelectedImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-2">
            <DialogHeader className="flex flex-row items-center justify-between">
              <DialogTitle>Image Viewer</DialogTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  const link = document.createElement('a')
                  link.href = selectedImage
                  link.download = `backtest-${backtest?.pair || 'analysis'}-${Date.now()}.png`
                  link.click()
                }}
              >
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </DialogHeader>
            <div className="relative w-full h-[85vh]">
              <div className="w-full h-full flex items-center justify-center">
                <Image
                  src={selectedImage}
                  alt="Full screen view"
                  className="max-w-full max-h-full object-contain"
                  width={1200}
                  height={800}
                />
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
