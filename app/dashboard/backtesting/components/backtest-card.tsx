'use client'

import React, { useState } from 'react'
import Image from 'next/image'
import { Target, MoreHorizontal, Eye, Pencil as Edit, Trash2 as Trash } from "lucide-react"
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { RevealAction } from '@/components/ui/reveal-action'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { BacktestTrade } from '@/types/backtesting-types'
import { Skeleton } from '@/components/ui/skeleton'

interface BacktestCardProps {
  backtest: BacktestTrade
  onView?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function BacktestCard({ backtest, onView, onEdit, onDelete }: BacktestCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false)
  const [imageError, setImageError] = useState(false)

  const isWin = backtest.outcome === 'WIN'
  const isLoss = backtest.outcome === 'LOSS'
  const hasPreviewImage = backtest.cardPreviewImage

  const formatSession = (session: string) => {
    return session.split('_').map(word =>
      word.charAt(0) + word.slice(1).toLowerCase()
    ).join(' ')
  }

  const formatModel = (model: string, customModel?: string) => {
    if (model === 'CUSTOM' && customModel) return customModel
    return model.replace(/_/g, ' ')
  }

  const getOutcomeVariant = (): "default" | "secondary" | "destructive" | "outline" => {
    if (isWin) return 'default'
    if (isLoss) return 'destructive'
    return 'outline'
  }

  const getDirectionColor = () => {
    return 'text-foreground'
  }

  return (
    <Card className="group hover:shadow-lg transition-all duration-200 hover:-translate-y-1 h-full flex flex-col">
      <CardHeader className="pb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-muted-foreground rounded-full flex-shrink-0" />
              <h3 className="font-semibold text-foreground truncate">
                {backtest.pair}
              </h3>
            </div>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <RevealAction size="icon" className="h-10 w-10" aria-label="Backtest options">
                <MoreHorizontal className="h-4 w-4" />
              </RevealAction>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onView}>
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Edit className="h-4 w-4 mr-2" />
                Edit Backtest
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={onDelete} className="text-destructive">
                <Trash className="h-4 w-4 mr-2" />
                Delete Backtest
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 flex-1 flex flex-col">
        {                   }
        <div className="relative aspect-video overflow-hidden bg-muted rounded-lg">
          {hasPreviewImage && backtest.cardPreviewImage ? (
            <>
              <Image
                src={backtest.cardPreviewImage}
                alt={`Backtest ${backtest.pair} ${backtest.direction}`}
                fill
                className="object-cover"
                onLoad={() => setImageLoaded(true)}
                onError={() => setImageError(true)}
              />
              {!imageLoaded && !imageError && (
                <Skeleton className="absolute inset-0" />
              )}
              {imageError && (
                <div className="absolute inset-0 bg-muted flex items-center justify-center">
                  <div className="text-muted-foreground text-sm">Image not available</div>
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 bg-muted flex items-center justify-center">
              <div className="text-muted-foreground text-sm">No preview image</div>
            </div>
          )}
        </div>

        {                              }
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Result</p>
            <Badge variant={getOutcomeVariant()} className="text-xs">
              {backtest.outcome}
            </Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">R:R</p>
            <p className="font-semibold text-foreground">
              1:{backtest.riskRewardRatio.toFixed(2)}
            </p>
          </div>
        </div>

        {                                           }
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Model</p>
            <p className="font-semibold text-foreground text-xs truncate">
              {formatModel(backtest.model, backtest.customModel)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Session</p>
            <p className="font-semibold text-foreground text-xs">
              {formatSession(backtest.session)}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Direction</p>
            <Badge variant="outline" className={`text-xs ${getDirectionColor()}`}>
              {backtest.direction}
            </Badge>
          </div>
        </div>

        {                            }
        <div className="grid grid-cols-1 gap-4">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Date</p>
            <p className="font-semibold text-foreground text-sm">
              {new Date(backtest.dateExecuted).toLocaleDateString()}
            </p>
          </div>
        </div>

        {          }
        {backtest.tags && backtest.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-auto">
            {backtest.tags.slice(0, 3).map((tag, idx) => (
              <Badge key={idx} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
