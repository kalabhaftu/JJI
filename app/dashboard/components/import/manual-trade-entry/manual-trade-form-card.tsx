'use client'

import React, { useState, useEffect, useRef } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { LexicalEditor } from '@/components/ui/editor/lexical-editor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { toast } from 'sonner'
import { reportClientError } from '@/lib/observability/report-error'
import { apiRequestData, ApiClientError } from '@/lib/api/client'
import { HugeiconsIcon } from '@hugeicons/react'
import { CalculatorIcon, TrendingUpDownIcon } from '@hugeicons/core-free-icons'
import type { TradeType } from '@/lib/db/schema/trades';

import { generateTradeHash } from '@/lib/trading/trade-grouping'
import type { importTradesThroughApi } from '@/lib/api/trade-import-client'
import { createManualTradeSubmission } from './manual-trade-submission'
import { ManualTradeValidationError } from './manual-trade-validation-error'
import { calculatePnL, calculateDuration } from '@/lib/utils/trade-calculations'
import { useUserStore } from '@/store/user-store'
import { useRouter } from 'next/navigation'
import { useAccounts } from '@/hooks/use-accounts'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'


const COMMON_INSTRUMENTS = [
  'ES', 'NQ', 'YM', 'RTY',
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD',
  'XAUUSD', 'XAGUSD',
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA',
  'BTC/USD', 'ETH/USD',
] as const


const TRADING_SESSIONS = [
  { value: 'asian', label: 'Asian Session' },
  { value: 'london', label: 'London Session' }, 
  { value: 'new-york', label: 'New York Session' },
  { value: 'overlap', label: 'Session Overlap' },
] as const


const MARKET_BIAS = [
  { value: 'bullish', label: 'Bullish' },
  { value: 'bearish', label: 'Bearish' },
  { value: 'neutral', label: 'Neutral' },
] as const


const TRADE_TYPES = [
  { value: 'scalp', label: 'Scalp' },
  { value: 'intraday', label: 'Intraday' },
  { value: 'swing', label: 'Swing' },
  { value: 'position', label: 'Position' },
] as const


const EMOTIONAL_STATES = [
  { value: 'confident', label: 'Confident' },
  { value: 'calm', label: 'Calm' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'fomo', label: 'FOMO' },
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'overconfident', label: 'Overconfident' },
  { value: 'anxious', label: 'Anxious' },
] as const


const tradeFormSchema = z.object({

  instrument: z.string().min(1, 'Instrument is required'),
  accountNumber: z.string().min(1, 'Account is required'),
  quantity: z.number().min(1, 'Quantity must be at least 1'),
  side: z.enum(['LONG', 'SHORT']),
  entryPrice: z.string().min(1, 'Entry price is required'),
  closePrice: z.string().min(1, 'Close price is required'),
  entryDate: z.string().min(1, 'Entry date is required'),
  entryTime: z.string().min(1, 'Entry time is required'),
  closeDate: z.string().min(1, 'Close date is required'),
  closeTime: z.string().min(1, 'Close time is required'),
  pnl: z.number(),
  commission: z.number().default(0),
  

  stopLoss: z.string().min(1, 'Stop Loss is required'),
  takeProfit: z.string().min(1, 'Take Profit is required'),
  

  session: z.string().optional(),
  bias: z.string().optional(),
  tradeType: z.string().optional(),
  emotionalState: z.string().optional(),
  riskPercent: z.number().optional(),
  
  comment: z.string().optional(),
})

type TradeFormData = z.infer<typeof tradeFormSchema>

interface ManualTradeFormCardProps {
  accountId: string
  accountNumber?: string
}

type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7

const TOTAL_STEPS = 7

export default function ManualTradeFormCard({ accountId, accountNumber: propFirmAccountNumber }: ManualTradeFormCardProps) {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [phaseValidationError, setPhaseValidationError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [calculatedPnL, setCalculatedPnL] = useState<number | null>(null)
  const [calculatedDuration, setCalculatedDuration] = useState<string>('')
  const submissionRef = useRef<ReturnType<typeof createManualTradeSubmission<TradeFormData>> | null>(null)
  
  const user = useUserStore(state => state.user)
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const router = useRouter()
  const queryClient = useQueryClient()
  const scope = useQueryScope()

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors }
  } = useForm<TradeFormData>({
    resolver: zodResolver(tradeFormSchema),
    mode: 'onChange',
    defaultValues: {
      entryDate: new Date().toISOString().split('T')[0] || '',
      entryTime: new Date().toTimeString().split(' ')[0]?.slice(0, 5) || '',
      closeDate: new Date().toISOString().split('T')[0] || '',
      closeTime: new Date().toTimeString().split(' ')[0]?.slice(0, 5) || '',
      quantity: 1,
      commission: 0,
      pnl: 0,
      stopLoss: '',
      takeProfit: '',
      accountNumber: propFirmAccountNumber || '',
    }
  })


  const entryPrice = watch('entryPrice')
  const closePrice = watch('closePrice')
  const quantity = watch('quantity')
  const side = watch('side')
  const commission = watch('commission')
  const entryDate = watch('entryDate')
  const entryTime = watch('entryTime')
  const closeDate = watch('closeDate')
  const closeTime = watch('closeTime')

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
  

  const unifiedAccounts = React.useMemo(() => {
    return allAccounts.filter(acc => {

      if (acc.accountType === 'live') return true
      

      if (acc.accountType === 'prop-firm') {

        const phaseStatus = (acc as any).currentPhase?.status || acc.status
        return phaseStatus === 'active'
      }
      
      return false
    })
  }, [allAccounts])

  const existingAccounts = unifiedAccounts.map(account => account.number)

  const onSubmit = async (data: TradeFormData) => {
    const currentUser = user || supabaseUser
    if (!currentUser?.id) {
      toast.error('Authentication Error', {
        description: 'Please sign in to add trades.',
      })
      return
    }

    try {
      const buildImport = (submitted: TradeFormData) => {
        const entryDateTime = `${submitted.entryDate} ${submitted.entryTime}`
        const closeDateTime = `${submitted.closeDate} ${submitted.closeTime}`
        const entryDate = new Date(`${submitted.entryDate}T${submitted.entryTime}`)
        const closeDate = new Date(`${submitted.closeDate}T${submitted.closeTime}`)
        const tradeData: any = {
          ...submitted,
          entryDate: entryDateTime,
          closeDate: closeDateTime,
          timeInPosition: (closeDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60),
          comment: submitted.comment || null,
          userId: currentUser.id,
          entryId: null,
          groupId: null,
        }
        return { accountId, trades: [{ ...tradeData, id: generateTradeHash({ ...tradeData, userId: currentUser.id }), createdAt: new Date() }] }
      }
      if (!submissionRef.current) {
        submissionRef.current = createManualTradeSubmission<TradeFormData>({
          validate: async (submitted) => {
            try {
              const data = await apiRequestData<{ accountType?: 'regular' | 'prop-firm'; phaseNumber?: number }>(
                '/api/v1/prop-firm/accounts/validate-trade',
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ accountNumber: submitted.accountNumber }),
                  retry: { mode: 'never' },
                  operation: 'validate-manual-trade-phase',
                }
              )
              return { status: 200, payload: { success: true, data } }
            } catch (error) {
              if (error instanceof ApiClientError) {
                return { status: error.status, payload: { success: false, ...(error.requestId ? { requestId: error.requestId } : {}) } }
              }
              return { status: 0, payload: null }
            }
          },
          buildImport,
          onStateChange: (state) => {
            setIsSubmitting(state.status === 'submitting')
            setPhaseValidationError(state.status === 'blocked' ? state.message : null)
          },
        })
      }
      const result = await submissionRef.current.submit(data)
      if (result.status !== 'success') return
      const job = result.result as Awaited<ReturnType<typeof importTradesThroughApi>>
      const accountName = typeof job.meta?.accountName === 'string'
        ? job.meta.accountName
        : 'the account'

      if (job.importedCount === 0) {
        toast.info("Trade Already Exists", {
          description: "This trade already exists in the account",
          duration: 5000,
        })
        return
      }

      toast.success('Trade Added', {
        description: `Trade successfully saved and linked to ${accountName}`,
      })


      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.dataManagementAccounts(scope) })


      router.push(`/dashboard/prop-firm/accounts/${accountId}/trades`)

    } catch (error) {
      reportClientError(error, { operation: 'save-manual-trade-card', route: '/api/v1/trades' })
      

      let errorMessage = 'An error occurred while saving the trade. Please try again.'
      let errorTitle = 'Save Failed'
      
      if (error instanceof Error) {
        if (error.message.includes('phase transition')) {
          errorTitle = "Phase Transition Required"
          errorMessage = error.message
        } else if (error.message.includes('account')) {
          errorTitle = "Account Error"
          errorMessage = error.message
        } else if (error.message.includes('authentication')) {
          errorTitle = "Authentication Error"
          errorMessage = "Please log in again and try saving your trade."
        } else {
          errorMessage = error.message
        }
      }
      
      toast.error(errorTitle, {
        description: errorMessage,
        duration: 8000,
      })
    }
  }

  return (
    <Card className="w-full max-h-none">
      <CardHeader>
        <CardTitle className="text-base">Add Single Trade</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="manual-trade-form" onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
        {}
        {phaseValidationError && <ManualTradeValidationError message={phaseValidationError} disabled={isSubmitting} retry={() => void submissionRef.current?.retry()} />}
        
        {}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Trade Execution</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="instrument">Instrument *</Label>
              <Controller
                name="instrument"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select or type instrument" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMMON_INSTRUMENTS.map(instrument => (
                        <SelectItem key={instrument} value={instrument}>
                          {instrument}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <Input
                placeholder="Or type custom instrument"
                {...register('instrument')}
                className="mt-2"
              />
              {errors.instrument && (
                <p className="text-sm text-destructive">{errors.instrument.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountNumber">Account *</Label>
              <Controller
                name="accountNumber"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select account" />
                    </SelectTrigger>
                    <SelectContent>
                      {existingAccounts.map(account => (
                        <SelectItem key={account} value={account}>
                          {account}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.accountNumber && (
                <p className="text-sm text-destructive">{errors.accountNumber.message}</p>
              )}
              {existingAccounts.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  No accounts found. Please create an account first.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="side">Direction *</Label>
              <Controller
                name="side"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select direction" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LONG">
                        <div className="flex items-center">
                          <HugeiconsIcon icon={TrendingUpDownIcon} className="w-4 h-4 mr-2 text-long" />
                          Long
                        </div>
                      </SelectItem>
                      <SelectItem value="SHORT">
                        <div className="flex items-center">
                          <HugeiconsIcon icon={TrendingUpDownIcon} className="w-4 h-4 mr-2 text-short" />
                          Short
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.side && (
                <p className="text-sm text-destructive">{errors.side.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input
                type="number"
                min="1"
                step="1"
                {...register('quantity', { valueAsNumber: true })}
              />
              {errors.quantity && (
                <p className="text-sm text-destructive">{errors.quantity.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryPrice">Entry Price *</Label>
              <Input
                type="number"
                step="0.01"
                {...register('entryPrice')}
              />
              {errors.entryPrice && (
                <p className="text-sm text-destructive">{errors.entryPrice.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="closePrice">Close Price *</Label>
              <Input
                type="number"
                step="0.01"
                {...register('closePrice')}
              />
              {errors.closePrice && (
                <p className="text-sm text-destructive">{errors.closePrice.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timing</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="entryDate">Entry Date *</Label>
              <Input
                type="date"
                {...register('entryDate')}
              />
              {errors.entryDate && (
                <p className="text-sm text-destructive">{errors.entryDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="entryTime">Entry Time *</Label>
              <Input
                type="time"
                {...register('entryTime')}
              />
              {errors.entryTime && (
                <p className="text-sm text-destructive">{errors.entryTime.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="closeDate">Close Date *</Label>
              <Input
                type="date"
                {...register('closeDate')}
              />
              {errors.closeDate && (
                <p className="text-sm text-destructive">{errors.closeDate.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="closeTime">Close Time *</Label>
              <Input
                type="time"
                {...register('closeTime')}
              />
              {errors.closeTime && (
                <p className="text-sm text-destructive">{errors.closeTime.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <HugeiconsIcon icon={CalculatorIcon} className="w-4 h-4 mr-2" />
              Financial Results
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="pnl">P&L</Label>
              <Input
                type="number"
                step="0.01"
                {...register('pnl', { valueAsNumber: true })}
                className={calculatedPnL !== null ? (calculatedPnL >= 0 ? 'border-long' : 'border-short') : ''}
              />
              {calculatedPnL !== null && (
                <p className={`text-sm ${calculatedPnL >= 0 ? 'text-long' : 'text-short'}`}>
                  Auto-calculated: ${calculatedPnL.toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="commission">Commission</Label>
              <Input
                type="number"
                step="0.01"
                {...register('commission', { valueAsNumber: true })}
              />
            </div>

            <div className="space-y-2">
              <Label>Duration</Label>
              <div className="p-2 bg-muted rounded text-sm">
                {calculatedDuration || 'Will calculate automatically'}
              </div>
            </div>
          </CardContent>
        </Card>

        {}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Analysis & Context (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-0">
            <div className="space-y-2">
              <Label htmlFor="session">Trading Session</Label>
              <Controller
                name="session"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select session" />
                    </SelectTrigger>
                    <SelectContent>
                      {TRADING_SESSIONS.map(session => (
                        <SelectItem key={session.value} value={session.value}>
                          {session.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bias">Market Bias</Label>
              <Controller
                name="bias"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select bias" />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKET_BIAS.map(bias => (
                        <SelectItem key={bias.value} value={bias.value}>
                          {bias.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tradeType">Trade Type</Label>
              <Controller
                name="tradeType"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value || ''}>
                    <SelectTrigger>
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

            <div className="space-y-2">
              <Label htmlFor="emotionalState">Emotional State</Label>
              <Controller
                name="emotionalState"
                control={control}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value ?? ""}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select emotion" />
                    </SelectTrigger>
                    <SelectContent>
                      {EMOTIONAL_STATES.map(emotion => (
                        <SelectItem key={emotion.value} value={emotion.value}>
                          {emotion.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="space-y-2 md:col-span-2 lg:col-span-4">
              <Label htmlFor="comment">Trade Notes</Label>
              <Controller
                name="comment"
                control={control}
                render={({ field }) => (
                  <LexicalEditor
                    value={field.value || ''}
                    onChange={field.onChange}
                    placeholder="Analysis, confluence factors, market conditions, lessons learned..."
                    minHeight="60px"
                  />
                )}
              />
            </div>
          </CardContent>
        </Card>

        {}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="secondary"
            onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/trades`)}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="manual-trade-form"
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Adding Trade...' : 'Add Trade'}
          </Button>
        </div>
        </form>
      </CardContent>
    </Card>
  )
}
