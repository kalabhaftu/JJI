'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { formatPercent } from '@/lib/trading/trade-formatting'

interface CircularProgressProps {
  value: number
  size?: number
  strokeWidth?: number
  className?: string
  showPercentage?: boolean
  color?: string
  backgroundColor?: string
  type?: 'circle' | 'gauge' | 'segmented-gauge'

  segments?: { wins: number; breakeven: number; losses: number }
}

export function CircularProgress({
  value,
  size = 80,
  strokeWidth = 8,
  className,
  showPercentage = true,
  color = 'hsl(var(--primary))',
  backgroundColor = 'hsl(var(--border))',
  type = 'gauge',
  segments,
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2
  const isGauge = type === 'gauge' || type === 'segmented-gauge'
  const isSegmented = type === 'segmented-gauge' && segments

  const circumference = isGauge ? radius * Math.PI : radius * 2 * Math.PI

  const getSegmentedPaths = () => {
    if (!segments) return null
    const total = segments.wins + segments.breakeven + segments.losses
    if (total === 0) return null

    const winPercent = (segments.wins / total) * 100
    const bePercent = (segments.breakeven / total) * 100
    const lossPercent = (segments.losses / total) * 100

    const winLength = (winPercent / 100) * circumference
    const beLength = (bePercent / 100) * circumference
    const lossLength = (lossPercent / 100) * circumference

    return { winLength, beLength, lossLength, winPercent, bePercent, lossPercent }
  }

  const segmentData = getSegmentedPaths()
  const offset = circumference - (value / 100) * circumference

  const arcPath = `M ${strokeWidth / 2} ${size / 2} A ${radius} ${radius} 0 0 1 ${size - strokeWidth / 2} ${size / 2}`
  const circlePath = `M ${size / 2} ${strokeWidth / 2} A ${radius} ${radius} 0 1 1 ${size / 2} ${size - strokeWidth / 2} A ${radius} ${radius} 0 1 1 ${size / 2} ${strokeWidth / 2}`

  return (
    <div className={cn('relative inline-flex flex-col items-center', className)}>
      <svg
        width={size}
        height={isGauge ? size / 2 + strokeWidth : size}
        className={cn(isGauge ? '' : 'transform -rotate-90')}
        viewBox={`0 0 ${size} ${isGauge ? size / 2 + strokeWidth : size}`}
      >
        {                           }
        <path
          d={isGauge ? arcPath : circlePath}
          stroke={backgroundColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
        />

        {isSegmented && segmentData ? (
          <>
            {                                            }
            <path
              d={arcPath}
              stroke="hsl(var(--chart-profit))"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${segmentData.winLength} ${circumference}`}
              strokeDashoffset={0}
              strokeLinecap="round"
              className="transition-all duration-500 ease-in-out"
            />
            {                                                  }
            {segmentData.beLength > 0 && (
              <path
                d={arcPath}
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${segmentData.beLength} ${circumference}`}
                strokeDashoffset={-segmentData.winLength}
                strokeLinecap="round"
                className="transition-all duration-500 ease-in-out"
              />
            )}
            {                                                        }
            <path
              d={arcPath}
              stroke="hsl(var(--chart-loss))"
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${segmentData.lossLength} ${circumference}`}
              strokeDashoffset={-(segmentData.winLength + segmentData.beLength)}
              strokeLinecap="round"
              className="transition-all duration-500 ease-in-out"
            />
          </>
        ) : (

          <path
            d={isGauge ? arcPath : circlePath}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-in-out"
          />
        )}
      </svg>

      {                                }
      {isSegmented && segmentData && segments && (
        <div className="flex items-center justify-center gap-3 mt-1">
          <span className="text-xs font-bold text-profit">{segments.wins}</span>
          {segments.breakeven > 0 && (
          <span className="text-xs font-bold text-muted-foreground">{segments.breakeven}</span>
          )}
          <span className="text-xs font-bold text-loss">{segments.losses}</span>
        </div>
      )}

      {showPercentage && !isSegmented && (
        <div className={cn(
          "absolute flex items-center justify-center",
          isGauge ? "bottom-0 left-0 right-0" : "inset-0"
        )}>
          <span className="text-sm font-semibold text-foreground">
            {formatPercent(value, 1)}
          </span>
        </div>
      )}
    </div>
  )
}
