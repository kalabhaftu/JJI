'use client'

import { Spinner } from '@/components/ui/spinner'

import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Loader2, User, AlertCircle, CheckCircle2, Building2, DollarSign } from "lucide-react"
import { toast } from "sonner"
import { clearAccountsCache } from "@/hooks/use-accounts"

// Popular brokers
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

  const onSubmit = async (data: LiveAccountFormData) => {
    try {
      setIsSubmitting(true)

      const finalBroker = data.broker === 'Other' ? data.customBroker : data.broker

      const payload = {
        name: data.name.trim(),
        number: data.number.trim(),
        startingBalance: data.startingBalance,
        broker: finalBroker
      }

      const response = await fetch('/api/v1/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create account')
      }

      toast.success("Account created!", {
        description: `Your ${finalBroker} account has been added.`,
      })

      // Dispatch custom event to notify onboarding system instantly
      if (typeof window !== 'undefined' && result.data?.id) {
        document.dispatchEvent(
          new CustomEvent('jji-account-created', {
            detail: { id: result.data.id, type: 'live' }
          })
        )
      }

      clearAccountsCache()
      reset()
      onSuccess?.()
      onOpenChange(false)

    } catch (error) {
      toast.error("Failed to create account", {
        description: error instanceof Error ? error.message : "Please try again",
      })
    } finally {
      setIsSubmitting(false)
    }
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
        <DialogContent className="w-full max-w-2xl">
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
            onSubmit={handleSubmit(onSubmit)}
            onKeyDown={(e) => {
              // Prevent Enter key from submitting the form when in input fields
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
                        <SelectTrigger>
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
                    <Input
                      id="startingBalance"
                      type="number"
                      step="0.01"
                      {...register('startingBalance', { valueAsNumber: true })}
                      className="pl-9"
                    />
                  </div>
                  {errors.startingBalance && (
                    <p className="text-sm text-destructive mt-1">{errors.startingBalance.message}</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Account Summary */}
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

            {/* Error Display */}
            {Object.keys(errors).length > 0 && (
              <Card className="border-destructive">
                <CardContent className="pt-6">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-5 w-5 text-destructive mt-0.5" />
                    <div>
                      <p className="font-medium text-destructive">Please fix the following errors:</p>
                      <ul className="list-disc list-inside text-sm text-muted-foreground mt-2">
                        {Object.entries(errors).map(([key, error]) => (
                          <li key={key}>{error?.message}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
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

