'use client'

import { Spinner } from '@/components/ui/spinner'

import { useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CurrencyField, FormErrorSummary } from '@/components/ui/domain-fields'
import { focusFirstInvalidField } from '@/lib/form-fields'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { reportClientError } from '@/lib/observability/report-error'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { User, CheckCircle2, Building2, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'
import { emitTourEvent } from '@/lib/tours/events'


const POPULAR_BROKERS = [
  'Exness',
  'FBS',
  'IC Markets',
  'MetaTrader 5',
  'NinjaTrader',
  'cTrader',
  'TradingView',
  'Alpaca',
  'Robinhood',
  'Webull',
  'Tastyworks',
  'TradeStation',
  'Thinkorswim',
  'OANDA',
  'FXCM',
  'Pepperstone',
  'XTB',
  'eToro',
  'Plus500',
  'AvaTrade',
  'XM',
  'Admiral Markets',
  'Other'
]

const liveAccountSchema = z.object({
  name: z.string().min(3, 'Account name must be at least 3 characters').max(50, 'Too long'),
  number: z.string().min(6, 'Account number must be at least 6 characters').max(20, 'Too long'),
  startingBalance: z.number().min(10, 'Minimum balance $10').max(1000000, 'Maximum $1,000,000'),
  broker: z.string().min(1, 'Please select a broker'),
  customBroker: z.string().optional(),
})

type LiveAccountFormData = z.infer<typeof liveAccountSchema>

interface LiveAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateLiveAccountDialog({ open, onOpenChange, onSuccess }: LiveAccountDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const queryClient = useQueryClient()
  const scope = useQueryScope()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    reset,
  } = useForm<LiveAccountFormData>({
    resolver: zodResolver(liveAccountSchema),
    defaultValues: {
      name: '',
      number: '',
      startingBalance: 10000,
      broker: '',
      customBroker: '',
    }
  })

  const watchedBroker = watch('broker')

  const createMutation = useMutation({
    mutationFn: (payload: { name: string; number: string; startingBalance: number; broker: string }) =>
      apiRequestData<{ id: string }>('/api/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        retry: { mode: 'never' },
        operation: 'create-live-account',
      }),
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
      toast.success("Account created!", {
        description: `Your ${variables.broker} account has been added.`,
      })

      if (typeof window !== 'undefined' && result?.id) {
        document.dispatchEvent(
          new CustomEvent('jji-account-created', {
            detail: { id: result.id, type: 'live' }
          })
        )
        emitTourEvent('account.created', { id: result.id })
      }

      reset()
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error) => {
      reportClientError(error, { operation: 'create-live-account', route: '/api/v1/accounts' })
      toast.error("Failed to create account", {
        description: error instanceof Error ? error.message : "Please try again",
      })
    },
    onSettled: () => {
      setIsSubmitting(false)
    },
  })

  const onSubmit = (data: LiveAccountFormData) => {
    const finalBroker = data.broker === 'Other' ? data.customBroker : data.broker

    const payload = {
      name: data.name.trim(),
      number: data.number.trim(),
      startingBalance: data.startingBalance,
      broker: finalBroker ?? ''
    }

    setIsSubmitting(true)
    createMutation.mutate(payload)
  }

  const handleDialogClose = (openState: boolean) => {
    if (!openState && isDirty && !isSubmitting) {
      setShowCloseConfirm(true)
    } else {
      onOpenChange(openState)
      if (!openState) reset()
    }
  }

  const handleConfirmClose = () => {
    setShowCloseConfirm(false)
    reset()
    onOpenChange(false)
  }

  return (
    <>
      <AlertDialog open={showCloseConfirm} onOpenChange={setShowCloseConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved changes. Closing will discard all progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continue editing</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmClose} className="bg-destructive">
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={open} onOpenChange={handleDialogClose}>
        <DialogContent className="w-full max-w-2xl" data-tour="create-account-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Create Live Account
            </DialogTitle>
            <DialogDescription>
              Add a new live trading account
            </DialogDescription>
          </DialogHeader>

          <form
            ref={formRef}
            onSubmit={handleSubmit(onSubmit, () => focusFirstInvalidField(formRef.current ?? document))}
            onKeyDown={(e) => {

              if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
                e.preventDefault()
              }
            }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle>Account Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="name">Account Name *</Label>
                  <Input
                    id="name"
                    data-tour="account-name-input"
                    {...register('name')}
                    placeholder="e.g., Main Trading Account"
                  />
                  {errors.name && (
                    <p className="text-sm text-destructive mt-1">{errors.name.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="number">Account Number *</Label>
                  <Input
                    id="number"
                    {...register('number')}
                    placeholder="e.g., 12345678"
                  />
                  {errors.number && (
                    <p className="text-sm text-destructive mt-1">{errors.number.message}</p>
                  )}
                </div>

                <div>
                  <Label htmlFor="broker">Broker *</Label>
                  <Controller
                    name="broker"
                    control={control}
                    render={({ field }) => (
                      <Select onValueChange={field.onChange} value={field.value}>
                        <SelectTrigger data-tour="account-broker-select">
                          <SelectValue placeholder="Select your broker" />
                        </SelectTrigger>
                        <SelectContent className="max-h-[300px]">
                          {POPULAR_BROKERS.map(broker => (
                            <SelectItem key={broker} value={broker}>
                              <div className="flex items-center gap-2">
                                <Building2 className="h-4 w-4" />
                                {broker}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  {errors.broker && (
                    <p className="text-sm text-destructive mt-1">{errors.broker.message}</p>
                  )}
                </div>

                {watchedBroker === 'Other' && (
                  <div>
                    <Label htmlFor="customBroker">Custom Broker Name *</Label>
                    <Input
                      id="customBroker"
                      {...register('customBroker')}
                      placeholder="Enter broker name"
                    />
                    {errors.customBroker && (
                      <p className="text-sm text-destructive mt-1">{errors.customBroker.message}</p>
                    )}
                  </div>
                )}

                <div>
                  <Label htmlFor="startingBalance">Starting Balance ($) *</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Controller
                      name="startingBalance"
                      control={control}
                      render={({ field }) => (
                        <CurrencyField
                          id="startingBalance"
                          data-tour="account-balance-input"
                          aria-label="Starting balance"
                          aria-invalid={errors.startingBalance ? true : undefined}
                          value={field.value}
                          onValueChange={field.onChange}
                          className="pl-9"
                        />
                      )}
                    />
                  </div>
                  {errors.startingBalance && (
                    <p className="text-sm text-destructive mt-1">{errors.startingBalance.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {}
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
                <CardDescription>Review your account details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <Label className="text-xs text-muted-foreground">Account Name</Label>
                    <p className="font-semibold">{watch('name') || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Account Number</Label>
                    <p className="font-semibold">{watch('number') || '-'}</p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Broker</Label>
                    <p className="font-semibold">
                      {watchedBroker === 'Other' ? (watch('customBroker') || '-') : (watchedBroker || '-')}
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Starting Balance</Label>
                    <p className="font-semibold">${watch('startingBalance')?.toLocaleString() || '0'}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {}
            <FormErrorSummary
              errors={Object.fromEntries(
                Object.entries(errors).map(([key, error]) => [key, error?.message])
              )}
            />

            {}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => handleDialogClose(false)}
                disabled={isSubmitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting} data-tour="create-account-submit">
                {isSubmitting ? (
                  <>
                    <Spinner className="h-4 w-4mr-2" />
                    Creating...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Create Account
                  </>
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  )
}
