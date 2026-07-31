'use client'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { LexicalEditor } from '@/components/ui/editor/lexical-editor'
import { BacktestDirection, BacktestModel, BacktestOutcome, BacktestSession } from '@/types/backtesting-types'
import { zodResolver } from '@hookform/resolvers/zod'
import { Camera, Settings as SettingsIcon, TrendingUp as TrendUp, X } from "lucide-react"
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'

// Schema for manual mode
const manualBacktestSchema = z.object({
  pair: z.string().min(1, 'Pair is required'),
  direction: z.enum(['BUY', 'SELL']),
  session: z.enum(['NEW_YORK', 'ASIAN', 'LONDON']),
  model: z.enum(['ICT_2022', 'MSNR', 'TTFM', 'PRICE_ACTION', 'SUPPLY_DEMAND', 'SMART_MONEY', 'CUSTOM']),
  customModel: z.string().optional(),

  entryPrice: z.string().min(1, 'Entry price is required'),
  stopLoss: z.string().min(1, 'Stop loss is required'),
  exitPrice: z.string().min(1, 'Exit price is required'),

  outcome: z.enum(['WIN', 'LOSS', 'BREAKEVEN']),
  notes: z.string().optional(),
  tags: z.string().optional(),
})

// Schema for simple R:R mode
const simpleBacktestSchema = z.object({
  pair: z.string().min(1, 'Pair is required'),
  direction: z.enum(['BUY', 'SELL']),
  session: z.enum(['NEW_YORK', 'ASIAN', 'LONDON']),
  model: z.enum(['ICT_2022', 'MSNR', 'TTFM', 'PRICE_ACTION', 'SUPPLY_DEMAND', 'SMART_MONEY', 'CUSTOM']),
  customModel: z.string().optional(),

  riskRewardRatio: z.string().min(1, 'R:R ratio is required'),
  riskPoints: z.string().min(1, 'Risk is required'),
  rewardPoints: z.string().min(1, 'Reward is required'),

  outcome: z.enum(['WIN', 'LOSS', 'BREAKEVEN']),
  notes: z.string().optional(),
  tags: z.string().optional(),
})

type ManualBacktestFormValues = z.infer<typeof manualBacktestSchema>
type SimpleBacktestFormValues = z.infer<typeof simpleBacktestSchema>
type BacktestFormValues = ManualBacktestFormValues | SimpleBacktestFormValues

interface AddBacktestFormProps {
  onAdd?: (backtest: any) => void
  onDirtyChange?: (isDirty: boolean) => void
}

// Common trading instruments with their typical price ranges
const COMMON_INSTRUMENTS = [
  // Forex Majors
  { symbol: 'EUR/USD', category: 'Forex', placeholder: '1.08500' },
  { symbol: 'GBP/USD', category: 'Forex', placeholder: '1.26500' },
  { symbol: 'USD/JPY', category: 'Forex', placeholder: '148.500' },
  { symbol: 'USD/CHF', category: 'Forex', placeholder: '0.88500' },
  { symbol: 'AUD/USD', category: 'Forex', placeholder: '0.65500' },
  { symbol: 'USD/CAD', category: 'Forex', placeholder: '1.34200' },
  { symbol: 'NZD/USD', category: 'Forex', placeholder: '0.60500' },

  // Forex Crosses
  { symbol: 'EUR/GBP', category: 'Forex', placeholder: '0.85500' },
  { symbol: 'EUR/JPY', category: 'Forex', placeholder: '161.500' },
  { symbol: 'GBP/JPY', category: 'Forex', placeholder: '188.500' },

  { symbol: 'NAS100', category: 'Indices', placeholder: '16250.50' },
  { symbol: 'US30', category: 'Indices', placeholder: '38500.00' },
  { symbol: 'SPX500', category: 'Indices', placeholder: '4850.00' },
  { symbol: 'US100', category: 'Indices', placeholder: '16250.50' },
  { symbol: 'GER40', category: 'Indices', placeholder: '17200.00' },
  { symbol: 'UK100', category: 'Indices', placeholder: '7650.00' },

  { symbol: 'GOLD', category: 'Commodities', placeholder: '2025.50' },
  { symbol: 'XAU/USD', category: 'Commodities', placeholder: '2025.50' },
  { symbol: 'SILVER', category: 'Commodities', placeholder: '23.50' },
  { symbol: 'XAG/USD', category: 'Commodities', placeholder: '23.50' },
  { symbol: 'WTI', category: 'Commodities', placeholder: '78.50' },
  { symbol: 'BRENT', category: 'Commodities', placeholder: '82.50' },

  { symbol: 'BTC/USD', category: 'Crypto', placeholder: '42500.00' },
  { symbol: 'ETH/USD', category: 'Crypto', placeholder: '2250.00' },
]

export function AddBacktestForm({ onAdd, onDirtyChange }: AddBacktestFormProps) {
  const [images, setImages] = useState<string[]>([])
  const [cardPreview, setCardPreview] = useState<string>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [filteredInstruments, setFilteredInstruments] = useState(COMMON_INSTRUMENTS)
  const [inputMode, setInputMode] = useState<'manual' | 'simple'>('manual')
  const [isLoadingMode, setIsLoadingMode] = useState(true)
  const suggestionsRef = useRef<HTMLDivElement>(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { errors, isDirty }
  } = useForm<any>({
    resolver: zodResolver(inputMode === 'manual' ? manualBacktestSchema : simpleBacktestSchema),
    defaultValues: {
      direction: 'BUY',
      session: 'NEW_YORK',
      model: 'ICT_2022',
      outcome: 'WIN',
    }
  })

  useEffect(() => {
    if (onDirtyChange) {
      const hasImages = images.length > 0 || !!cardPreview
      onDirtyChange(isDirty || hasImages)
    }
  }, [isDirty, images, cardPreview, onDirtyChange])

  const watchedModel = watch('model')
  const watchedDirection = watch('direction')
  const watchedOutcome = watch('outcome')
  const watchedPair = watch('pair')
  const watchedEntryPrice = watch('entryPrice')
  const watchedExitPrice = watch('exitPrice')
  const watchedStopLoss = watch('stopLoss')
  const watchedRiskPoints = watch('riskPoints')
  const watchedRewardPoints = watch('rewardPoints')
  const watchedRR = watch('riskRewardRatio')

  const getPricePlaceholder = () => {
    const instrument = COMMON_INSTRUMENTS.find(
      inst => inst.symbol.toLowerCase() === watchedPair?.toLowerCase()
    )
    return instrument?.placeholder || '0.00000'
  }

  const handlePairInputChange = (value: string) => {
    setValue('pair', value)

    if (value.length > 0) {
      const filtered = COMMON_INSTRUMENTS.filter(inst =>
        inst.symbol.toLowerCase().includes(value.toLowerCase()) ||
        inst.category.toLowerCase().includes(value.toLowerCase())
      )
      setFilteredInstruments(filtered)
      setShowSuggestions(true)
    } else {
      setFilteredInstruments(COMMON_INSTRUMENTS)
      setShowSuggestions(false)
    }
  }

  const selectInstrument = (symbol: string) => {
    setValue('pair', symbol)
    setShowSuggestions(false)
  }

  useEffect(() => {
    const fetchMode = async () => {
      try {
        const response = await fetch('/api/v1/settings/backtest-mode')
        if (response.ok) {
          const data = await response.json()
          setInputMode(data.mode || 'manual')
        }
      } catch (error) {
      } finally {
        setIsLoadingMode(false)
      }
    }
    fetchMode()
  }, [])

  const handleModeChange = async (newMode: 'manual' | 'simple') => {
    setInputMode(newMode)
    try {
      await fetch('/api/v1/settings/backtest-mode', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: newMode })
      })
      toast.success(`Switched to ${newMode === 'manual' ? 'Full Manual' : 'Simple R:R'} mode`)
    } catch (error) {
      toast.error('Failed to save preference')
    }
  }

  useEffect(() => {
    const currentPnL = calculatePnL()
    const currentOutcome = watch('outcome')

    if (inputMode === 'manual' && currentPnL !== 0) {
      // In manual mode, auto-detect outcome from P&L
      const detectedOutcome = currentPnL > 0 ? 'WIN' : currentPnL < 0 ? 'LOSS' : 'BREAKEVEN'

      if (currentOutcome !== detectedOutcome) {
        setValue('outcome', detectedOutcome)
      }
    } else if (inputMode === 'simple') {
      // In simple mode, validate that outcome matches the risk/reward logic
      const risk = parseFloat(watch('riskPoints') || '0')
      const reward = parseFloat(watch('rewardPoints') || '0')

      if (risk > 0 && reward > 0) {
        // Ensure P&L calculation matches outcome
        const expectedPnL = calculatePnL()

        if (currentOutcome === 'WIN' && expectedPnL <= 0) {
          toast.warning('Outcome set to WIN but P&L will be negative')
        } else if (currentOutcome === 'LOSS' && expectedPnL >= 0) {
          toast.warning('Outcome set to LOSS but P&L will be positive')
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchedEntryPrice, watchedExitPrice, watchedStopLoss, watchedRiskPoints, watchedRewardPoints, inputMode])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    if (showSuggestions) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSuggestions])

  const handleImageUpload = (file: File, isCardPreview: boolean = false) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const result = e.target?.result as string
      if (isCardPreview) {
        setCardPreview(result)
      } else {
        if (images.length < 6) {
          setImages(prev => [...prev, result])
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

  const calculateRisk = () => {
    if (inputMode === 'simple') {
      return parseFloat(watch('riskPoints') || '0')
    }

    const entry = parseFloat(watch('entryPrice') || '0')
    const sl = parseFloat(watch('stopLoss') || '0')

    if (!entry || !sl) return 0

    return Math.abs(entry - sl)
  }

  const calculateReward = () => {
    if (inputMode === 'simple') {
      return parseFloat(watch('rewardPoints') || '0')
    }

    const entry = parseFloat(watch('entryPrice') || '0')
    const exit = parseFloat(watch('exitPrice') || '0')

    if (!entry || !exit) return 0

    return Math.abs(entry - exit)
  }

  const calculateRR = () => {
    if (inputMode === 'simple') {
      const rr = parseFloat(watch('riskRewardRatio') || '0')
      return rr
    }

    const risk = calculateRisk()
    const reward = calculateReward()

    if (risk <= 0) return 0

    return reward / risk
  }

  const calculatePnL = () => {
    const outcome = watch('outcome')
    const direction = watch('direction')

    if (inputMode === 'simple') {
      const risk = parseFloat(watch('riskPoints') || '0')
      const reward = parseFloat(watch('rewardPoints') || '0')

      if (!risk || !reward) return 0

      if (outcome === 'WIN') return reward
      if (outcome === 'LOSS') return -risk
      return 0
    }

    const entry = parseFloat(watch('entryPrice') || '0')
    const exit = parseFloat(watch('exitPrice') || '0')

    if (!entry || !exit) return 0

    let pnl = 0
    if (direction === 'BUY') {
      pnl = exit - entry
    } else if (direction === 'SELL') {
      pnl = entry - exit
    }

    return pnl
  }

  const onSubmit = async (data: any) => {
    setIsSubmitting(true)
    try {
      const rr = calculateRR()
      const pnl = calculatePnL()
      const risk = calculateRisk()
      const reward = calculateReward()

      if (pnl !== 0) {
        const expectedOutcome = pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'BREAKEVEN'
        if (data.outcome !== expectedOutcome) {
          toast.error('Cannot submit!', {
            description: `P&L is ${pnl >= 0 ? 'positive (+' + pnl.toFixed(2) + ')' : 'negative (' + pnl.toFixed(2) + ')'} but outcome is ${data.outcome}. Please check your data.`
          })
          setIsSubmitting(false)
          return
        }
      }

      let entryPrice, exitPrice, stopLoss, takeProfit

      if (inputMode === 'simple') {
        entryPrice = '0'
        exitPrice = '0'
        stopLoss = '0'
        takeProfit = '0'
      } else {
        entryPrice = data.entryPrice
        exitPrice = data.exitPrice
        stopLoss = data.stopLoss
        takeProfit = data.exitPrice // Use exit price as take profit
      }

      const backtestData = {
        pair: data.pair,
        direction: data.direction,
        session: data.session,
        model: data.model,
        customModel: data.customModel,
        entryPrice,
        stopLoss,
        takeProfit,
        exitPrice,
        outcome: data.outcome,
        riskRewardRatio: rr,
        riskPoints: risk,
        rewardPoints: reward,
        pnl: pnl,
        notes: data.notes,
        tags: data.tags ? data.tags.split(',').map((t: string) => t.trim()) : [],
        images,
        cardPreviewImage: cardPreview,
        dateExecuted: new Date().toISOString(),
      }

      if (onAdd) {
        await onAdd(backtestData)
      }

      reset()
      setImages([])
      setCardPreview('')
    } catch (error) {
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Trade Setup */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendUp className="w-5 h-5" />
            Backtest Setup
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2 relative">
              <Label htmlFor="pair">Pair / Instrument *</Label>
              <Input
                id="pair"
                {...register('pair')}
                placeholder="EUR/USD, NAS100, GOLD, XAU/USD"
                className={errors.pair ? 'border-destructive' : ''}
                onChange={(e) => handlePairInputChange(e.target.value)}
                onFocus={() => setShowSuggestions(true)}
                autoComplete="off"
              />
              {errors.pair && (
                <p className="text-xs text-destructive">{String(errors.pair.message)}</p>
              )}

              {showSuggestions && filteredInstruments.length > 0 && (
                <div
                  ref={suggestionsRef}
                  className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-60 overflow-y-auto"
                >
                  <div className="p-2">
                    <p className="text-xs text-muted-foreground mb-2 px-2">Suggestions:</p>
                    {['Forex', 'Indices', 'Commodities', 'Crypto'].map(category => {
                      const categoryItems = filteredInstruments.filter(
                        inst => inst.category === category
                      )
                      if (categoryItems.length === 0) return null

                      return (
                        <div key={category} className="mb-2">
                          <p className="text-xs font-semibold text-muted-foreground px-2 py-1">
                            {category}
                          </p>
                          {categoryItems.map(inst => (
                            <button
                              key={inst.symbol}
                              type="button"
                              onClick={() => selectInstrument(inst.symbol)}
                              className="w-full text-left px-2 py-1.5 hover:bg-accent rounded text-sm"
                            >
                              {inst.symbol}
                            </button>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="direction">Direction *</Label>
              <Select
                value={watchedDirection}
                onValueChange={(value) => setValue('direction', value as BacktestDirection)}
              >
                <SelectTrigger id="direction">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BUY">Buy</SelectItem>
                  <SelectItem value="SELL">Sell</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="session">Trading Session *</Label>
              <Select
                value={watch('session')}
                onValueChange={(value) => setValue('session', value as BacktestSession)}
              >
                <SelectTrigger id="session">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASIAN">Asian</SelectItem>
                  <SelectItem value="LONDON">London</SelectItem>
                  <SelectItem value="NEW_YORK">New York</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="outcome">Outcome *</Label>
              <Select
                value={watchedOutcome}
                onValueChange={(value) => setValue('outcome', value as BacktestOutcome)}
              >
                <SelectTrigger id="outcome">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WIN">Win</SelectItem>
                  <SelectItem value="LOSS">Loss</SelectItem>
                  <SelectItem value="BREAKEVEN">Breakeven</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="model">Trading Model *</Label>
            <Select
              value={watchedModel}
              onValueChange={(value) => setValue('model', value as BacktestModel)}
            >
              <SelectTrigger id="model">
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Price Levels & Execution</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" type="button">
                  <SettingsIcon className="w-4 h-4 mr-2" />
                  {inputMode === 'manual' ? 'Full Manual' : 'Simple R:R'}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleModeChange('manual')}>
                  <div className="flex flex-col">
                    <span className="font-semibold">Full Manual</span>
                    <span className="text-xs text-muted-foreground">Entry, Exit, Stop Loss</span>
                  </div>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleModeChange('simple')}>
                  <div className="flex flex-col">
                    <span className="font-semibold">Simple R:R</span>
                    <span className="text-xs text-muted-foreground">Just R:R and P&L</span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {inputMode === 'manual' ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="entryPrice">Entry Price *</Label>
                <Input
                  id="entryPrice"
                  type="number"
                  step="0.00001"
                  {...register('entryPrice')}
                  placeholder={getPricePlaceholder()}
                  className={errors.entryPrice ? 'border-destructive' : ''}
                />
                {errors.entryPrice && (
                  <p className="text-xs text-destructive">{String(errors.entryPrice.message)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="exitPrice">Exit Price *</Label>
                <Input
                  id="exitPrice"
                  type="number"
                  step="0.00001"
                  {...register('exitPrice')}
                  placeholder={getPricePlaceholder()}
                  className={errors.exitPrice ? 'border-destructive' : ''}
                />
                {errors.exitPrice && (
                  <p className="text-xs text-destructive">{String(errors.exitPrice.message)}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="stopLoss">Stop Loss *</Label>
                <Input
                  id="stopLoss"
                  type="number"
                  step="0.00001"
                  {...register('stopLoss')}
                  placeholder={getPricePlaceholder()}
                  className={errors.stopLoss ? 'border-destructive' : ''}
                />
                {errors.stopLoss && (
                  <p className="text-xs text-destructive">{String(errors.stopLoss.message)}</p>
                )}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="riskPoints">Risk (Points/Pips) *</Label>
                <Input
                  id="riskPoints"
                  type="number"
                  step="0.01"
                  {...register('riskPoints')}
                  placeholder="50"
                  className={errors.riskPoints ? 'border-destructive' : ''}
                />
                {errors.riskPoints && (
                  <p className="text-xs text-destructive">{String(errors.riskPoints.message)}</p>
                )}
                <p className="text-xs text-muted-foreground">SL distance from entry</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="rewardPoints">Reward (Points/Pips) *</Label>
                <Input
                  id="rewardPoints"
                  type="number"
                  step="0.01"
                  {...register('rewardPoints')}
                  placeholder="150"
                  className={errors.rewardPoints ? 'border-destructive' : ''}
                />
                {errors.rewardPoints && (
                  <p className="text-xs text-destructive">{String(errors.rewardPoints.message)}</p>
                )}
                <p className="text-xs text-muted-foreground">TP distance from entry</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="riskRewardRatio">R:R Ratio *</Label>
                <Input
                  id="riskRewardRatio"
                  type="number"
                  step="0.1"
                  {...register('riskRewardRatio')}
                  placeholder="3.0"
                  className={errors.riskRewardRatio ? 'border-destructive' : ''}
                />
                {errors.riskRewardRatio && (
                  <p className="text-xs text-destructive">{String(errors.riskRewardRatio.message)}</p>
                )}
                <p className="text-xs text-muted-foreground">Should match risk/reward</p>
              </div>
            </div>
          )}

          {inputMode === 'manual' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Risk (Points)</p>
                <p className="text-lg font-bold">{calculateRisk().toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Reward (Points)</p>
                <p className="text-lg font-bold">{calculateReward().toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">R:R Ratio</p>
                <p className="text-lg font-bold">1:{calculateRR().toFixed(2)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">P&L (Points)</p>
                <div className="flex items-center gap-2">
                  <p className={`text-lg font-bold ${calculatePnL() >= 0 ? 'text-long' : 'text-short'}`}>
                    {calculatePnL() >= 0 ? '+' : ''}{calculatePnL().toFixed(2)}
                  </p>
                  {calculatePnL() !== 0 && (
                    <Badge variant="outline" className="text-xs">
                      {calculatePnL() > 0 ? 'WIN' : calculatePnL() < 0 ? 'LOSS' : 'BE'}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          )}
          {inputMode === 'simple' && (
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Calculated R:R</p>
                <p className="text-lg font-bold">1:{calculateRR().toFixed(2)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {calculateReward().toFixed(2)} ÷ {calculateRisk().toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Calculated P&L</p>
                <div className="flex items-center gap-2">
                  <p className={`text-lg font-bold ${calculatePnL() >= 0 ? 'text-long' : 'text-short'}`}>
                    {calculatePnL() >= 0 ? '+' : ''}{calculatePnL().toFixed(2)}
                  </p>
                  {calculatePnL() !== 0 && (
                    <Badge variant="outline" className="text-xs">
                      {calculatePnL() > 0 ? 'WIN' : calculatePnL() < 0 ? 'LOSS' : 'BE'}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Based on {watch('outcome')} outcome
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Notes & Tags</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="notes">Backtest Notes</Label>
            <Controller
              control={control}
              name="notes"
              render={({ field }) => (
                <LexicalEditor
                  placeholder="Add your analysis, observations, and lessons learned from this backtest..."
                  value={field.value || ''}
                  onChange={field.onChange}
                  minHeight="150px"
                />
              )}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="tags">Tags (comma separated)</Label>
            <Input
              id="tags"
              {...register('tags')}
              placeholder="fibonacci, liquidity sweep, fair value gap"
            />
            <p className="text-xs text-muted-foreground">
              Separate tags with commas for better organization
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Screenshots & Images
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-sm font-medium">Card Preview Image</Label>
            <div className="max-w-xs">
              {cardPreview ? (
                <div className="relative aspect-video group">
                  <Image
                    src={cardPreview}
                    alt="Card preview"
                    fill
                    className="object-cover rounded-lg"
                  />
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => setCardPreview('')}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                  <div className="absolute bottom-2 left-2 bg-primary text-primary-foreground px-2 py-1 rounded text-xs font-medium">
                    Preview
                  </div>
                </div>
              ) : (
                <label className="border-2 border-dashed rounded-lg aspect-video flex items-center justify-center cursor-pointer hover:border-primary transition-colors bg-muted/30">
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
                    <p className="text-xs text-muted-foreground">Upload</p>
                  </div>
                </label>
              )}
            </div>
          </div>

          <div className="border-t pt-4">
            <Label className="text-sm font-medium mb-3 block">Additional Screenshots</Label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {[0, 1, 2, 3, 4, 5].map((idx) => (
                <div key={idx} className="space-y-2">
                  {images[idx] ? (
                    <div className="relative group aspect-video">
                      <Image
                        src={images[idx]}
                        alt={`Screenshot ${idx + 1}`}
                        fill
                        className="object-cover rounded-lg"
                      />
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => removeImage(idx)}
                      >
                        <X className="w-3 h-3" />
                      </Button>
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
                        <p className="text-xs text-muted-foreground">#{idx + 1}</p>
                      </div>
                    </label>
                  )}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            reset()
            setImages([])
            setCardPreview('')
          }}
        >
          Reset
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Adding...' : 'Add Backtest'}
        </Button>
      </div>
    </form>
  )
}

