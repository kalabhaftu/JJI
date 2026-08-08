'use client'

import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { TradePreviewImage } from '@/components/trades/trade-preview-image'
import {
  MAX_TRADE_PREVIEW_ZOOM,
  MIN_TRADE_PREVIEW_ZOOM,
  clampTradePreviewTransform,
  clampTradePreviewZoom,
  DEFAULT_TRADE_PREVIEW_TRANSFORM,
  normalizeTradePreviewTransform,
  type TradePreviewTransform,
} from '@/lib/trade-preview'
import { cn } from '@/lib/utils'
import { HugeiconsIcon } from '@hugeicons/react'
import { Move01Icon, RotateLeft01Icon, SearchAddIcon, SearchMinusIcon } from '@hugeicons/core-free-icons'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'

interface TradePreviewCropEditorProps {
  src: string
  alt: string
  value?: unknown
  disabled?: boolean
  onError?: () => void
  onChange: (transform: TradePreviewTransform) => void
}

interface DragState {
  startX: number
  startY: number
  initial: TradePreviewTransform
  width: number
  height: number
}

export function TradePreviewCropEditor({
  src,
  alt,
  value,
  disabled = false,
  onError,
  onChange,
}: TradePreviewCropEditorProps) {
  const transform = normalizeTradePreviewTransform(value)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const dragStateRef = useRef<DragState | null>(null)
  const [isDragging, setIsDragging] = useState(false)

  const updateTransform = useCallback(
    (nextTransform: Partial<TradePreviewTransform>) => {
      onChange(clampTradePreviewTransform({ ...transform, ...nextTransform }))
    },
    [onChange, transform]
  )

  const stopDragging = useCallback(() => {
    dragStateRef.current = null
    setIsDragging(false)
  }, [])

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const dragState = dragStateRef.current
      if (!dragState || disabled) return

      const deltaX = ((event.clientX - dragState.startX) / dragState.width) * 100
      const deltaY = ((event.clientY - dragState.startY) / dragState.height) * 100

      onChange(
        clampTradePreviewTransform({
          zoom: dragState.initial.zoom,
          x: dragState.initial.x + deltaX,
          y: dragState.initial.y + deltaY,
        })
      )
    }

    const handlePointerUp = () => {
      stopDragging()
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointercancel', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointercancel', handlePointerUp)
    }
  }, [disabled, onChange, stopDragging])

  const handlePointerDown = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (disabled || !containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      dragStateRef.current = {
        startX: event.clientX,
        startY: event.clientY,
        initial: transform,
        width: rect.width || 1,
        height: rect.height || 1,
      }

      setIsDragging(true)
      event.preventDefault()
    },
    [disabled, transform]
  )

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className={cn(
          'relative aspect-video overflow-hidden rounded-xl border border-border/50 bg-muted/30',
          disabled ? 'cursor-default opacity-80' : isDragging ? 'cursor-grabbing' : 'cursor-grab'
        )}
        onPointerDown={handlePointerDown}
      >
        <TradePreviewImage
          src={src}
          alt={alt}
          transform={transform}
          unoptimized
          loading="eager"
          {...(onError ? { onError: () => onError() } : {})}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between bg-gradient-to-t from-background/85 via-background/35 to-transparent px-3 py-2">
          <div className="flex items-center gap-1.5 rounded-full border border-border/50 bg-background/80 px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <HugeiconsIcon icon={Move01Icon} className="h-3 w-3" strokeWidth={2} color="currentColor" />
            Drag to frame
          </div>
          <div className="rounded-full border border-border/50 bg-background/80 px-2 py-1 text-[10px] font-semibold text-foreground">
            {Math.round(transform.zoom * 100)}%
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/50 bg-muted/15 p-3">
        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Zoom out"
          title="Zoom out"
          className="h-9 w-9"
          onClick={() => updateTransform({ zoom: clampTradePreviewZoom(transform.zoom - 0.15) })}
          disabled={disabled}
        >
          <HugeiconsIcon icon={SearchMinusIcon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
        </Button>

        <div className="min-w-[160px] flex-1 px-1">
          <Slider
            value={[transform.zoom]}
            min={MIN_TRADE_PREVIEW_ZOOM}
            max={MAX_TRADE_PREVIEW_ZOOM}
            step={0.05}
            onValueChange={([zoom]) => updateTransform({ zoom: zoom! })}
            disabled={disabled}
            aria-label="Preview zoom"
          />
        </div>

        <Button
          type="button"
          variant="secondary"
          size="icon"
          aria-label="Zoom in"
          title="Zoom in"
          className="h-9 w-9"
          onClick={() => updateTransform({ zoom: clampTradePreviewZoom(transform.zoom + 0.15) })}
          disabled={disabled}
        >
          <HugeiconsIcon icon={SearchAddIcon} className="h-4 w-4" strokeWidth={2} color="currentColor" />
        </Button>

        <Button
          type="button"
          variant="tertiary"
          size="sm"
          className="ml-auto h-9 rounded-lg px-3 text-xs font-semibold"
          onClick={() => onChange({ ...DEFAULT_TRADE_PREVIEW_TRANSFORM })}
          disabled={disabled}
        >
          <HugeiconsIcon icon={RotateLeft01Icon} className="mr-1.5 h-3.5 w-3.5" strokeWidth={2} color="currentColor" />
          Reset
        </Button>
      </div>
    </div>
  )
}
