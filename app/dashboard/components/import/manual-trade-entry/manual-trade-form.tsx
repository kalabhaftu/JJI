'use client'

import { Spinner } from '@/components/ui/spinner'
import { Skeleton } from '@/components/ui/skeleton'

import React, { useState, useEffect, useMemo, useRef, useReducer } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { LexicalEditor } from '@/components/ui/editor/lexical-editor'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  CalculatorIcon,
  TrendingUpDownIcon,
  ArrowLeft01Icon,
  ArrowRight01Icon,
  CircleCheckIcon,
  Loading01Icon,
  Wallet01Icon,
  BarChartIcon,
  Clock01Icon,
  Shield01Icon,
  Dollar01Icon,
  Brain01Icon,
  Shield02Icon
} from '@hugeicons/core-free-icons'
import type { TradeType } from '@/lib/db/schema/trades';

import { generateTradeHash } from '@/lib/trading/trade-grouping'
import { importTradesThroughApi } from '@/lib/api/trade-import-client'
import { calculatePnL, calculateDuration } from '@/lib/utils/trade-calculations'
import { useUserStore } from '@/store/user-store'
import { useAccounts } from '@/hooks/use-accounts'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'
import { cn } from '@/lib/utils'
import { phaseValidationReducer, runPhaseValidation } from '@/lib/validation/phase-validation'
import { ManualTradeValidationError } from './manual-trade-validation-error'
import { Badge } from '@/components/ui/badge'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'


const COMMON_INSTRUMENTS = [
  { value: 'ES', label: 'ES - E-mini S&P 500' },
  { value: 'NQ', label: 'NQ - E-mini Nasdaq 100' },
  { value: 'YM', label: 'YM - E-mini Dow' },
  { value: 'RTY', label: 'RTY - E-mini Russell' },
  { value: 'EURUSD', label: 'EURUSD - Euro/US Dollar' },
  { value: 'GBPUSD', label: 'GBPUSD - British Pound/US Dollar' },
  { value: 'USDJPY', label: 'USDJPY - US Dollar/Japanese Yen' },
  { value: 'AUDUSD', label: 'AUDUSD - Australian Dollar/US Dollar' },
  { value: 'XAUUSD', label: 'XAUUSD - Gold/US Dollar' },
  { value: 'XAGUSD', label: 'XAGUSD - Silver/US Dollar' },
  { value: 'US30', label: 'US30 - Dow Jones 30' },
  { value: 'US100', label: 'US100 - Nasdaq 100' },
  { value: 'US500', label: 'US500 - S&P 500' },
  { value: 'BTC/USD', label: 'BTC/USD - Bitcoin' },
  { value: 'ETH/USD', label: 'ETH/USD - Ethereum' },
]


const TRADING_SESSIONS = [
  { value: 'london-killzone', label: 'London Killzone' },
  { value: 'ny-killzone', label: 'NY Killzone' },
  { value: 'lunch-dead-zone', label: 'Lunch Dead Zone' },
  { value: 'ny-pm', label: 'NY PM Session' },
]


const MARKET_BIAS = [
  { value: 'bullish', label: 'Bullish' },
  { value: 'bearish', label: 'Bearish' },
  { value: 'neutral', label: 'Neutral' },
]


const TRADE_TYPES = [
  { value: 'scalp', label: 'Scalp' },
  { value: 'intraday', label: 'Intraday' },
  { value: 'swing', label: 'Swing' },
  { value: 'position', label: 'Position' },
]


const EMOTIONAL_STATES = [
  { value: 'confident', label: 'Confident' },
  { value: 'calm', label: 'Calm' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'fomo', label: 'FOMO' },
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'overconfident', label: 'Overconfident' },
  { value: 'anxious', label: 'Anxious' },
]


const tradeFormSchema = z.object({
  instrument: z.string().min(1, 'Instrument is required'),
  accountNumber: z.string().min(1, 'Account is required'),
  quantity: z.number().min(0.01, 'Quantity must be greater than 0'),
  side: z.enum(['LONG', 'SHORT']),
  entryPrice: z.string().min(1, 'Entry price is required'),
  closePrice: z.string().min(1, 'Close price is required'),
  entryDate: z.string().min(1, 'Entry date is required'),
  entryTime: z.string().min(1, 'Entry time is required'),
  closeDate: z.string().min(1, 'Close date is required'),
  closeTime: z.string().min(1, 'Close time is required'),
  pnl: z.number(),
  commission: z.number().default(0),
  stopLoss: z.string().optional(),
  takeProfit: z.string().optional(),
  session: z.string().optional(),
  bias: z.string().optional(),
  tradeType: z.string().optional(),
  emotionalState: z.string().optional(),
  comment: z.string().optional(),
  isMissedTrade: z.boolean().default(false),
  mae: z.string().optional(),
  mfe: z.string().optional(),
})

type TradeFormData = z.infer<typeof tradeFormSchema>

export function getManualTradeFormDefaults(initialValues?: Partial<TradeFormData>): Partial<TradeFormData> {
  const now = new Date()
  return {
    entryDate: now.toISOString().split('T')[0] || '',
    entryTime: now.toTimeString().split(' ')[0]?.slice(0, 5) || '',
    closeDate: now.toISOString().split('T')[0] || '',
    closeTime: now.toTimeString().split(' ')[0]?.slice(0, 5) || '',
    quantity: 1,
    commission: 0,
    pnl: 0,
    isMissedTrade: false,
    ...initialValues,
  }
}

interface ManualTradeFormProps {
  setIsOpen?: React.Dispatch<React.SetStateAction<boolean>>
  onClose?: () => void
  onBack?: () => void
  initialValues?: Partial<TradeFormData>
  onValuesChange?: (values: Partial<TradeFormData>) => void
  onSuccess?: () => void
}

type Step = 1 | 2 | 3 | 4 | 5

const TOTAL_STEPS = 5

const stepInfo = [
  { step: 1, title: 'Account & Instrument', icon: Wallet01Icon },
  { step: 2, title: 'Execution', icon: BarChartIcon },
  { step: 3, title: 'Timing', icon: Clock01Icon },
  { step: 4, title: 'Risk & Cost', icon: Shield01Icon },
  { step: 5, title: 'Review', icon: Shield02Icon },
]

export default function ManualTradeForm({ setIsOpen, onClose, onBack, initialValues, onValuesChange, onSuccess }: ManualTradeFormProps) {
  const queryClient = useQueryClient()
  const scope = useQueryScope()
  const handleClose = () => {
    if (onClose) onClose();
    else if (setIsOpen) setIsOpen(false);
  }
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [phaseValidation, dispatchPhaseValidation] = useReducer(phaseValidationReducer, { status: 'idle' })
  const [calculatedPnL, setCalculatedPnL] = useState<number | null>(null)
  const [calculatedDuration, setCalculatedDuration] = useState<string>('')
  const [instrumentOpen, setInstrumentOpen] = useState(false)
  const [instrumentSearch, setInstrumentSearch] = useState('')
  const submitInFlightRef = useRef(false)

  const user = useUserStore(state => state.user)
  const supabaseUser = useUserStore(state => state.supabaseUser)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    reset,
    formState: { errors }
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeFormSchema),
    mode: 'onChange',
    defaultValues: getManualTradeFormDefaults(initialValues)
  })

  const initialValuesKey = JSON.stringify(initialValues ?? {})
  useEffect(() => {
    reset(getManualTradeFormDefaults(JSON.parse(initialValuesKey) as Partial<TradeFormData>))
  }, [initialValuesKey, reset])

  const entryPrice = watch('entryPrice')
  const closePrice = watch('closePrice')
  const quantity = watch('quantity')
  const side = watch('side')
  const commission = watch('commission')
  const entryDate = watch('entryDate')
  const entryTime = watch('entryTime')
  const closeDate = watch('closeDate')
  const closeTime = watch('closeTime')
  const instrument = watch('instrument')
  const isMissedTrade = watch('isMissedTrade')
  const watchedValues = watch()
  const watchedValuesKey = JSON.stringify(watchedValues)

  useEffect(() => { onValuesChange?.(JSON.parse(watchedValuesKey) as Partial<TradeFormData>) }, [onValuesChange, watchedValuesKey])

  useEffect(() => {
    if (entryPrice && closePrice && quantity && side) {
      const pnl = calculatePnL({
        entryPrice,
        closePrice,
        quantity,
        side,
        commission: commission || 0
      })
      setCalculatedPnL(pnl)
      setValue('pnl', pnl, { shouldValidate: false, shouldDirty: false })
    }
  }, [entryPrice, closePrice, quantity, side, commission, setValue])

  useEffect(() => {
    if (entryDate && entryTime && closeDate && closeTime) {
      const duration = calculateDuration(entryDate, entryTime, closeDate, closeTime)
      setCalculatedDuration(duration)
    }
  }, [entryDate, entryTime, closeDate, closeTime])

  const { accounts: allAccounts, isLoading: isLoadingAccounts } = useAccounts()

  const unifiedAccounts = useMemo(() => {
    return allAccounts.filter(acc => {
      if (acc.accountType === 'live') return true
      if (acc.accountType === 'prop-firm') {
        const phaseStatus = (acc as any).currentPhase?.status || acc.status
        return phaseStatus === 'active'
      }
      return false
    })
  }, [allAccounts])


  const filteredInstruments = useMemo(() => {
    if (!instrumentSearch) return COMMON_INSTRUMENTS
    const search = instrumentSearch.toLowerCase()
    return COMMON_INSTRUMENTS.filter(
      i => i.value.toLowerCase().includes(search) || i.label.toLowerCase().includes(search)
    )
  }, [instrumentSearch])

  const validateStep = (step: Step): boolean => {
    const values = watch()
    switch (step) {
      case 1:
        return !!(values.accountNumber && values.instrument)
      case 2:
        return !!(values.side && values.quantity && values.entryPrice && values.closePrice)
      case 3:
        return !!(values.entryDate && values.entryTime && values.closeDate && values.closeTime)
      case 4:
        return true
      case 5:
        return true
      default:
        return false
    }
  }

  const canProceedToNext = validateStep(currentStep)

  const handleNext = () => {
    if (currentStep < TOTAL_STEPS && canProceedToNext) {
      setCurrentStep((currentStep + 1) as Step)
    }
  }

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep((currentStep - 1) as Step)
    }
  }

  const onSubmit = async (data: TradeFormData) => {
    if (submitInFlightRef.current) return
    const currentUser = user || supabaseUser
    if (!currentUser?.id) {
      toast.error('Authentication Error', { description: 'Please sign in to add trades.' })
      return
    }

    submitInFlightRef.current = true
    setIsSubmitting(true)

    try {

      if (data.accountNumber) {
        dispatchPhaseValidation({ type: 'check', accountNumber: data.accountNumber })
        const validation = await runPhaseValidation(data.accountNumber)
        dispatchPhaseValidation({ type: 'settle', result: validation })
        if (validation.status !== 'valid') {
          toast.error('Trade Validation Blocked', { description: validation.message })
          return
        }
      }

      const entryDateTime = `${data.entryDate} ${data.entryTime}`
      const closeDateTime = `${data.closeDate} ${data.closeTime}`

      const entryDateObj = new Date(`${data.entryDate}T${data.entryTime}`)
      const closeDateObj = new Date(`${data.closeDate}T${data.closeTime}`)
      const timeInPosition = (closeDateObj.getTime() - entryDateObj.getTime()) / (1000 * 60 * 60)

      const tradeData: any = {
        accountNumber: data.accountNumber,
        instrument: data.instrument,
        quantity: data.quantity,
        side: data.side,
        entryPrice: data.entryPrice,
        closePrice: data.closePrice,
        entryDate: entryDateTime,
        closeDate: closeDateTime,
        pnl: data.pnl,
        commission: data.commission,
        timeInPosition,
        stopLoss: data.stopLoss || null,
        takeProfit: data.takeProfit || null,
        comment: data.comment || null,
        userId: currentUser.id,
        entryId: null,
        groupId: null,
        isMissedTrade: data.isMissedTrade,
        mae: data.mae ? parseFloat(data.mae) : null,
        mfe: data.mfe ? parseFloat(data.mfe) : null,
      }

      const tradeId = generateTradeHash({ ...tradeData, userId: currentUser.id })
      const completeTrade: any = { ...tradeData, id: tradeId, createdAt: new Date() }

      const targetAccount = unifiedAccounts.find(acc => acc.number === data.accountNumber)

      if (!targetAccount) {
        toast.error('Account Not Found', { description: 'Could not find the selected account.' })
        return
      }

      const job = await importTradesThroughApi({
        accountId: targetAccount.id,
        trades: [completeTrade],
      })
      const accountName = typeof job.meta?.accountName === 'string'
        ? job.meta.accountName
        : 'account'

      if (job.importedCount === 0) {
        toast.info("Trade Already Exists", {
          description: "This trade already exists",
        })
        return
      }

      toast.success('Trade Added', {
        description: `Trade saved to ${accountName}`,
      })

      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.dataManagementAccounts(scope) })
      onSuccess?.()
      if (!onSuccess) handleClose()

    } catch (error) {
      reportClientError(error, { operation: 'save-manual-trade', route: '/api/v1/trades' })
      let errorMessage = 'An error occurred while saving the trade.'
      if (error instanceof Error) {
        errorMessage = error.message
      }
      toast.error('Save Failed', { description: errorMessage })
    } finally {
      submitInFlightRef.current = false
      setIsSubmitting(false)
    }
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div className="space-y-2">
              <Label>Account *</Label>
              {isLoadingAccounts ? (
                <Skeleton className="h-10 bg-muted rounded-md" />
              ) : (
                <Controller
                  name="accountNumber"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value || ''}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder={unifiedAccounts.length === 0 ? "No active accounts" : "Select account"} />
                      </SelectTrigger>
                      <SelectContent>
                        {unifiedAccounts.map(account => (
                          <SelectItem key={account.id} value={account.number}>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{account.displayName}</span>
                              <Badge variant="outline" className="text-xs">
                                {account.number}
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              )}
              {errors.accountNumber && (
                <p className="text-sm text-destructive">{errors.accountNumber.message}</p>
              )}
              {!isLoadingAccounts && unifiedAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No active accounts found. Create an account first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Instrument *</Label>
              <Controller
                name="instrument"
                control={control}
                render={({ field }) => (
                  <Popover open={instrumentOpen} onOpenChange={setInstrumentOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="secondary"
                        role="combobox"
                        aria-expanded={instrumentOpen}
                        className="w-full justify-between h-11 font-normal"
                      >
                        {field.value || "Select or type instrument"}
                        <HugeiconsIcon icon={BarChartIcon} className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[min(26rem,calc(100vw-1rem))] p-0" align="start" side="bottom">
                      <Command>
                        <CommandInput
                          placeholder="Search or type custom..."
                          value={instrumentSearch}
                          onValueChange={(value) => {
                            setInstrumentSearch(value)

                            if (value && !COMMON_INSTRUMENTS.find(i => i.value === value)) {
                              field.onChange(value.toUpperCase())
                            }
                          }}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {instrumentSearch ? (
                              <button
                                className="w-full px-4 py-2 text-left hover:bg-muted"
                                onClick={() => {
                                  field.onChange(instrumentSearch.toUpperCase())
                                  setInstrumentOpen(false)
                                }}
                              >
                                Use "{instrumentSearch.toUpperCase()}" as custom instrument
                              </button>
                            ) : (
                              "Type to search or add custom"
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredInstruments.map((instr) => (
                              <CommandItem
                                key={instr.value}
                                value={instr.value}
                                onSelect={() => {
                                  field.onChange(instr.value)
                                  setInstrumentOpen(false)
                                  setInstrumentSearch('')
                                }}
                              >
                                <HugeiconsIcon
                                  icon={CircleCheckIcon}
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    field.value === instr.value ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {instr.label}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                )}
              />
              {instrument && (
                <p className="text-sm text-muted-foreground">Selected: {instrument}</p>
              )}
              {errors.instrument && (
                <p className="text-sm text-destructive">{errors.instrument.message}</p>
              )}
            </div>
          </div>
        )

      case 2:
        return (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>Direction *</Label>
              <Controller
                name="side"
                control={control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2">
                      <Button
                      type="button"
                      variant={field.value === 'LONG' ? "primary" : "secondary"}
                      className={cn(
                        "h-12",
                        field.value === 'LONG' && "bg-long hover:bg-long/90"
                      )}
                      onClick={() => field.onChange('LONG')}
                    >
                      <HugeiconsIcon icon={TrendingUpDownIcon} className="h-4 w-4 mr-2" />
                      Long
                    </Button>
                    <Button
                      type="button"
                      variant={field.value === 'SHORT' ? "primary" : "secondary"}
                      className={cn(
                        "h-12",
                        field.value === 'SHORT' && "bg-short hover:bg-short/90"
                      )}
                      onClick={() => field.onChange('SHORT')}
                    >
                      <HugeiconsIcon icon={TrendingUpDownIcon} className="h-4 w-4 mr-2" />
                      Short
                    </Button>
                  </div>
                )}
              />
            </div>

            <div className="space-y-2 col-span-2 sm:col-span-1">
              <div className="flex items-center space-x-2 pt-6">
                <Controller
                  name="isMissedTrade"
                  control={control}
                  render={({ field }) => (
                    <Switch
                      id="isMissedTrade"
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  )}
                />
                <Label htmlFor="isMissedTrade" className="font-semibold text-primary">Missed Trade (Ghost Setup)</Label>
              </div>
              <p className="text-xs text-muted-foreground ml-11">Logs setup for journaling, but ignores P&L.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                id="quantity"
                type="number"
                min="0.01"
                step="0.01"
                className="h-11"
                {...register('quantity', { valueAsNumber: true })}
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryPrice">Entry Price *</Label>
              <Input
                id="entryPrice"
                type="number"
                step="any"
                className="h-11"
                placeholder="0.00"
                {...register('entryPrice')}
              />
              {errors.entryPrice && (
                <p className="text-sm text-destructive">{errors.entryPrice.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="closePrice">Exit Price *</Label>
              <Input
                id="closePrice"
                type="number"
                step="any"
                className="h-11"
                placeholder="0.00"
                {...register('closePrice')}
              />
              {errors.closePrice && (
                <p className="text-sm text-destructive">{errors.closePrice.message}</p>
              )}
            </div>

            {calculatedPnL !== null && (
              <div className="col-span-2 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Estimated P&L</span>
                  <span className={cn(
                    "text-xl font-bold",
                    calculatedPnL >= 0 ? "text-long" : "text-short"
                  )}>
                    {calculatedPnL >= 0 ? '+' : ''}${calculatedPnL.toFixed(2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        )

      case 3:
        return (
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="entryDate">Entry Date *</Label>
              <Input id="entryDate" type="date" className="h-11" {...register('entryDate')} />
              {errors.entryDate && (
                <p className="text-sm text-destructive">{errors.entryDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Entry Time *</Label>
              <Input type="time" className="h-11" {...register('entryTime')} />
              {errors.entryTime && (
                <p className="text-sm text-destructive">{errors.entryTime.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Exit Date *</Label>
              <Input type="date" className="h-11" {...register('closeDate')} />
              {errors.closeDate && (
                <p className="text-sm text-destructive">{errors.closeDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Exit Time *</Label>
              <Input type="time" className="h-11" {...register('closeTime')} />
              {errors.closeTime && (
                <p className="text-sm text-destructive">{errors.closeTime.message}</p>
              )}
            </div>

            {calculatedDuration && (
              <div className="col-span-2 p-4 rounded-lg border bg-muted/30">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Duration</span>
                  <span className="text-lg font-medium">{calculatedDuration}</span>
                </div>
              </div>
            )}
          </div>
        )

      case 4:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Stop Loss</Label>
                <Input
                  type="number"
                  step="any"
                  className="h-11"
                  placeholder="Optional"
                  {...register('stopLoss')}
                />
              </div>

              <div className="space-y-2">
                <Label>Take Profit</Label>
                <Input
                  type="number"
                  step="any"
                  className="h-11"
                  placeholder="Optional"
                  {...register('takeProfit')}
                />
              </div>

              <div className="space-y-2">
                <Label>MAE (Max Adverse Excursion)</Label>
                <Input
                  type="number"
                  step="any"
                  className="h-11"
                  placeholder="Optional"
                  {...register('mae')}
                />
              </div>

              <div className="space-y-2">
                <Label>MFE (Max Favorable Excursion)</Label>
                <Input
                  type="number"
                  step="any"
                  className="h-11"
                  placeholder="Optional"
                  {...register('mfe')}
                />
              </div>

              <div className="space-y-2">
                <Label>Commission</Label>
                <Input
                  type="number"
                  step="0.01"
                  className="h-11"
                  placeholder="0.00"
                  {...register('commission', { valueAsNumber: true })}
                />
              </div>

              <div className="space-y-2">
                <Label>Trade Type</Label>
                <Controller
                  name="tradeType"
                  control={control}
                  render={({ field }) => (
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        {TRADE_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Notes</Label>
              <Controller
                name="comment"
                control={control}
                render={({ field }) => (
                  <LexicalEditor
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Trade analysis, lessons learned..."
                    minHeight="100px"
                  />
                )}
              />
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-6">
            {phaseValidation.status === 'blocked' && <ManualTradeValidationError message={phaseValidation.message} retry={() => void handleSubmit(onSubmit as any)()} disabled={isSubmitting} />}

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Account</p>
                <p className="font-medium truncate">{watchedValues.accountNumber}</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Instrument</p>
                <p className="font-medium">{watchedValues.instrument}</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Direction</p>
                <Badge variant={watchedValues.side === 'LONG' ? 'default' : 'secondary'}>
                  {watchedValues.side}
                </Badge>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Quantity</p>
                <p className="font-medium">{watchedValues.quantity}</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Entry</p>
                <p className="font-medium">${watchedValues.entryPrice}</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Exit</p>
                <p className="font-medium">${watchedValues.closePrice}</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Entry Time</p>
                <p className="font-medium text-sm">{watchedValues.entryDate} {watchedValues.entryTime}</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Exit Time</p>
                <p className="font-medium text-sm">{watchedValues.closeDate} {watchedValues.closeTime}</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Commission</p>
                <p className="font-medium">${watchedValues.commission || 0}</p>
              </div>
            </div>

            <div className="p-6 rounded-lg border-2 border-primary/20 bg-primary/5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Final P&L</p>
                  {calculatedDuration && (
                    <p className="text-xs text-muted-foreground">Duration: {calculatedDuration}</p>
                  )}
                </div>
                <p className={cn(
                  "text-3xl font-bold",
                  calculatedPnL !== null && calculatedPnL >= 0 ? "text-long" : "text-short"
                )}>
                  {calculatedPnL !== null ? (calculatedPnL >= 0 ? '+' : '') + '$' + calculatedPnL.toFixed(2) : '$0.00'}
                </p>
              </div>
            </div>

            {watchedValues.comment && (
              <div className="p-4 rounded-lg border bg-muted/30">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{watchedValues.comment}</p>
              </div>
            )}
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="h-full flex flex-col">
      {}
      <div className="flex-none border-b p-4">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold">Add Single Trade</h2>
            <p className="text-sm text-muted-foreground">
              Step {currentStep} of {TOTAL_STEPS}: {stepInfo[currentStep - 1]!.title}
            </p>
          </div>
        </div>

        {}
        <div className="flex items-center gap-1">
          {stepInfo.map((s, idx) => {
            return (
              <React.Fragment key={s.step}>
                <div
                  className={cn(
                    "flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-all",
                    currentStep === s.step
                      ? "bg-primary text-primary-foreground font-medium"
                      : currentStep > s.step
                        ? "bg-primary/20 text-primary"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {currentStep > s.step ? (
                    <HugeiconsIcon icon={CircleCheckIcon} className="h-3 w-3" />
                  ) : (
                    <HugeiconsIcon icon={s.icon} className="h-3 w-3" />
                  )}
                  <span className="hidden sm:inline">{s.title}</span>
                </div>
                {idx < stepInfo.length - 1 && (
                  <div className={cn(
                    "h-px w-4 transition-colors",
                    currentStep > s.step ? "bg-primary" : "bg-border"
                  )} />
                )}
              </React.Fragment>
            )
          })}
        </div>
      </div>

      {}
      <div className="flex-1 overflow-y-auto p-6">
        <form id="manual-trade-form" onSubmit={handleSubmit(onSubmit as any)} className="h-full flex flex-col">
          {renderStepContent()}
        </form>
      </div>

      {}
      <div className="flex-none border-t p-4">
        <div className="flex justify-between items-center">
          {currentStep === 1 && onBack ? (
            <Button
              type="button"
              variant="secondary"
              onClick={onBack}
              className="gap-1.5"
            >
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-3.5 w-3.5" />
              Back to Platforms
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              onClick={handleClose}
            >
              Cancel
            </Button>
          )}

          <div className="flex items-center gap-3">
            {currentStep > 1 && (
              <Button
                type="button"
                variant="secondary"
                onClick={handleBack}
                className="gap-2"
              >
                <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4" />
                Back
              </Button>
            )}

            {currentStep < TOTAL_STEPS ? (
              <Button
                type="button"
                onClick={handleNext}
                disabled={!canProceedToNext}
                className="gap-2"
              >
                Next
                <HugeiconsIcon icon={ArrowRight01Icon} className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                form="manual-trade-form"
                disabled={isSubmitting}
                className="gap-2 min-w-[120px]"
              >
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4" />
                    Adding...
                  </>
                ) : (
                  <>
                    <HugeiconsIcon icon={CircleCheckIcon} className="h-4 w-4" />
                    Add Trade
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
