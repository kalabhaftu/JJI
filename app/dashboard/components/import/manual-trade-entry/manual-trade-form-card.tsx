'use client'

import React, { useState, useEffect } from 'react'
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
import { Calculator, TrendingUp, TrendingDown, AlertCircle } from 'lucide-react'
import type { TradeType } from '@/lib/db/schema/trades';

import { generateTradeHash } from '@/lib/utils'
import { calculatePnL, calculateDuration } from '@/lib/utils/trade-calculations'
import { useUserStore } from '@/store/user-store'
import { useRouter } from 'next/navigation'
import { useAccounts } from '@/hooks/use-accounts'

// Common instruments for quick selection
const COMMON_INSTRUMENTS = [
  'ES', 'NQ', 'YM', 'RTY', // Futures
  'EURUSD', 'GBPUSD', 'USDJPY', 'AUDUSD', // Forex majors
  'XAUUSD', 'XAGUSD', // Metals
  'AAPL', 'MSFT', 'GOOGL', 'AMZN', 'TSLA', // Stocks
  'BTC/USD', 'ETH/USD', // Crypto
] as const

// Trading sessions
const TRADING_SESSIONS = [
  { value: 'asian', label: 'Asian Session' },
  { value: 'london', label: 'London Session' }, 
  { value: 'new-york', label: 'New York Session' },
  { value: 'overlap', label: 'Session Overlap' },
] as const

// Market bias options
const MARKET_BIAS = [
  { value: 'bullish', label: 'Bullish' },
  { value: 'bearish', label: 'Bearish' },
  { value: 'neutral', label: 'Neutral' },
] as const

// Trade types
const TRADE_TYPES = [
  { value: 'scalp', label: 'Scalp' },
  { value: 'intraday', label: 'Intraday' },
  { value: 'swing', label: 'Swing' },
  { value: 'position', label: 'Position' },
] as const

// Emotional states
const EMOTIONAL_STATES = [
  { value: 'confident', label: 'Confident' },
  { value: 'calm', label: 'Calm' },
  { value: 'neutral', label: 'Neutral' },
  { value: 'fomo', label: 'FOMO' },
  { value: 'frustrated', label: 'Frustrated' },
  { value: 'overconfident', label: 'Overconfident' },
  { value: 'anxious', label: 'Anxious' },
] as const

// Form schema
const tradeFormSchema = z.object({
  // Basic execution details
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
  
  // Risk management (required)
  stopLoss: z.string().min(1, 'Stop Loss is required'),
  takeProfit: z.string().min(1, 'Take Profit is required'),
  
  // Analysis fields (optional)
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
  
  const user = useUserStore(state => state.user)
  const supabaseUser = useUserStore(state => state.supabaseUser)
  const router = useRouter()

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

  // Watch specific form values for calculations (not all values to prevent infinite loops)
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

  // Get unified accounts for dropdown - same as CSV import
  const { accounts: allAccounts, isLoading: isLoadingAccounts } = useAccounts()
  
  // For manual trade entry, only show active phases (where user can add trades)
  // Use same logic as account-selection component
  const unifiedAccounts = React.useMemo(() => {
    return allAccounts.filter(acc => {
      // Show all live accounts
      if (acc.accountType === 'live') return true
      
      // For prop-firm accounts: only show active phases (NOT passed or failed)
      if (acc.accountType === 'prop-firm') {
        // Check phase status - must be active (not passed, not failed)
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

    setIsSubmitting(true)
    setPhaseValidationError(null)
    
    try {
      // Check if this is a prop firm account and validate phase ID
      if (data.accountNumber) {
        try {
          const phaseCheckResponse = await fetch(`/api/v1/prop-firm/accounts/validate-trade`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              accountNumber: data.accountNumber
            })
          })
          
          const phaseResult = await phaseCheckResponse.json()
          
          if (!phaseCheckResponse.ok) {
            if (phaseCheckResponse.status === 403) {
              setPhaseValidationError(phaseResult.error || 'Please set the ID for the current phase before adding trades.')
              toast.error("Phase ID Required", {
                description: phaseResult.error || "Please set the ID for the current phase before adding trades.",
              })
              return
            }
          }
        } catch (error) {
          // If it's not a prop firm account or validation API doesn't exist, continue normally
        }
      }
      // Combine date and time for entry/close timestamps
      const entryDateTime = `${data.entryDate} ${data.entryTime}`
      const closeDateTime = `${data.closeDate} ${data.closeTime}`
      
      // Calculate time in position (in hours)
      const entryDate = new Date(`${data.entryDate}T${data.entryTime}`)
      const closeDate = new Date(`${data.closeDate}T${data.closeTime}`)
      const timeInPosition = (closeDate.getTime() - entryDate.getTime()) / (1000 * 60 * 60)

      // Create trade object
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
        comment: data.comment || null,
        userId: currentUser.id,
        entryId: null,
        groupId: null,
      }

      // Generate unique ID for the trade
      const tradeId = generateTradeHash({ ...tradeData, userId: currentUser.id })
      const completeTrade: any = {
        ...tradeData,
        id: tradeId,
        createdAt: new Date(),
      }

      // Atomic save and link operation
      const { saveAndLinkTrades } = await import("@/server/accounts")
      const result = await saveAndLinkTrades(accountId, [completeTrade])

      if (result.isDuplicate) {
        toast.info("Trade Already Exists", {
          description: 'message' in result ? result.message : "This trade already exists in the account",
          duration: 5000,
        })
        return
      }

      toast.success('Trade Added', {
        description: `Trade successfully saved and linked to ${'accountName' in result ? result.accountName : 'the account'}`,
      })

      // Invalidate accounts cache to trigger refresh
      const { invalidateAccountsCache } = await import("@/hooks/use-accounts")
      invalidateAccountsCache('trade saved')

      // Navigate back to trades list
      router.push(`/dashboard/prop-firm/accounts/${accountId}/trades`)

    } catch (error) {
      
      // Provide more specific error messages based on error type
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
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card className="w-full max-h-none">
      <CardHeader>
        <CardTitle className="text-base">Add Single Trade</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="manual-trade-form" onSubmit={handleSubmit(onSubmit as any)} className="space-y-4">
        {/* Phase Validation Error */}
        {phaseValidationError && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-md p-3">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-4 w-4 text-destructive" />
              </div>
              <div className="ml-3">
                <p className="text-sm text-destructive">{phaseValidationError}</p>
              </div>
            </div>
          </div>
        )}
        
        {/* Basic Trade Information */}
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
                          <TrendingUp className="w-4 h-4 mr-2 text-long" />
                          Long
                        </div>
                      </SelectItem>
                      <SelectItem value="SHORT">
                        <div className="flex items-center">
                          <TrendingDown className="w-4 h-4 mr-2 text-short" />
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

        {/* Date & Time */}
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

        {/* P&L and Commission */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center">
              <Calculator className="w-4 h-4 mr-2" />
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

        {/* Analysis & Context (Optional) */}
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

        {/* Form Actions */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="outline"
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
