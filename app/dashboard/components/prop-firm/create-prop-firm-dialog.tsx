'use client'

import { Spinner } from '@/components/ui/spinner'

import { useRef, useState, useEffect, useMemo } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CurrencyField, PercentageField } from '@/components/ui/domain-fields'
import { FormErrorSummary } from '@/components/ui/form-error-summary'
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Building2, AlertCircle, CheckCircle2, PenLine, Check, X } from "lucide-react"
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
import { emitTourEvent } from '@/lib/tours/events'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys, queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'


const propFirmSchema = z.object({
  accountName: z.string().min(3, 'Account name must be at least 3 characters').max(50, 'Too long'),
  propFirmName: z.string().min(1, 'Please select a prop firm'),
  accountSize: z.number().min(1000, 'Minimum $1,000'),
  evaluationType: z.enum(['One Step', 'Two Step', 'Instant']),
  phase1AccountId: z.string().min(1, 'Phase 1 ID is required'),


  phase1ProfitTargetPercent: z.number().min(0).max(100),
  phase1DailyDrawdownPercent: z.number().min(1).max(100),
  phase1MaxDrawdownPercent: z.number().min(1).max(100),
  phase1MaxDrawdownType: z.enum(['static', 'trailing']),
  phase1MinTradingDays: z.number().min(0),
  phase1TimeLimitDays: z.number().min(0).nullable(),


  phase2ProfitTargetPercent: z.number().min(0).max(100).optional(),
  phase2DailyDrawdownPercent: z.number().min(0).max(100).optional(),
  phase2MaxDrawdownPercent: z.number().min(0).max(100).optional(),
  phase2MaxDrawdownType: z.enum(['static', 'trailing']).optional(),
  phase2MinTradingDays: z.number().min(0).optional(),
  phase2TimeLimitDays: z.number().min(0).nullable().optional(),


  fundedDailyDrawdownPercent: z.number().min(1).max(100),
  fundedMaxDrawdownPercent: z.number().min(1).max(100),
  fundedMaxDrawdownType: z.enum(['static', 'trailing']),
  fundedProfitSplitPercent: z.number().min(0).max(100),
  fundedPayoutCycleDays: z.number().min(1).max(365),
  fundedMinProfitForPayout: z.number().min(0).default(100),
})

type PropFirmFormData = z.infer<typeof propFirmSchema>

interface PropFirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreatePropFirmDialog({ open, onOpenChange, onSuccess }: PropFirmDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showCloseConfirm, setShowCloseConfirm] = useState(false)
  const [isEditingRules, setIsEditingRules] = useState(false)
  const formRef = useRef<HTMLFormElement>(null)
  const queryClient = useQueryClient()
  const scope = useQueryScope()

  const templatesQuery = useQuery({
    queryKey: queryKeys.templates(scope),
    queryFn: ({ signal }) => apiRequestData<Record<string, any>>('/api/v1/prop-firm-templates', {
      signal,
      operation: 'load-prop-firm-templates',
    }),
    enabled: open && isScopeReady(scope),
    staleTime: 30_000,
  })

  const templates = useMemo(() => templatesQuery.data ?? {}, [templatesQuery.data])

  useEffect(() => {
    if (templatesQuery.error) {
      reportClientError(templatesQuery.error, { operation: 'load-prop-firm-templates', route: '/api/v1/prop-firm-templates' })
      toast.error('Failed to load templates')
    }
  }, [templatesQuery.error])

  const createMutation = useMutation({
    mutationFn: (payload: PropFirmFormData) =>
      apiRequestData<{ id: string; phases?: any[]; masterAccount?: any }>('/api/v1/prop-firm/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        retry: { mode: 'never' },
        operation: 'create-prop-firm-account',
      }),
    onSuccess: async (result, variables) => {
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.propFirmAccounts(scope) })
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })

      toast.success("Account created!", {
        description: `Your ${variables.propFirmName} account has been added.`,
      })

      if (typeof window !== 'undefined' && result) {
        const activePhase = result.phases?.find((p: any) => p.status === 'active')
        const activeId = activePhase?.id || result.masterAccount?.id
        if (activeId) {
          document.dispatchEvent(
            new CustomEvent('jji-account-created', {
              detail: { id: activeId, type: 'prop-firm' }
            })
          )
          emitTourEvent('account.created', { id: activeId })
        }
      }

      reset()
      onSuccess?.()
      onOpenChange(false)
    },
    onError: (error) => {
      if (error instanceof Error && error.message.includes('An account with this name already exists')) {
        setError('accountName', {
          type: 'manual',
          message: 'Account name already exists'
        })
      }
      reportClientError(error, { operation: 'create-prop-firm-account', route: '/api/v1/prop-firm/accounts' })
      toast.error("Failed to create account", {
        description: error instanceof Error ? error.message : "Please try again",
      })
    },
    onSettled: () => {
      setIsSubmitting(false)
    },
  })

  const onSubmit = (data: PropFirmFormData) => {
    setIsSubmitting(true)
    createMutation.mutate(data)
  }

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    setValue,
    reset,
    setError,
  } = useForm<PropFirmFormData>({
    resolver: zodResolver(propFirmSchema),
    defaultValues: {
      accountName: '',
      propFirmName: '',
      accountSize: 100000,
      evaluationType: 'Two Step',
      phase1AccountId: '',
      phase1ProfitTargetPercent: 10,
      phase1DailyDrawdownPercent: 5,
      phase1MaxDrawdownPercent: 10,
      phase1MaxDrawdownType: 'static',
      phase1MinTradingDays: 4,
      phase1TimeLimitDays: 30,
      phase2ProfitTargetPercent: 5,
      phase2DailyDrawdownPercent: 5,
      phase2MaxDrawdownPercent: 10,
      phase2MaxDrawdownType: 'static',
      phase2MinTradingDays: 4,
      phase2TimeLimitDays: 60,
      fundedDailyDrawdownPercent: 5,
      fundedMaxDrawdownPercent: 5,
      fundedMaxDrawdownType: 'static',
      fundedProfitSplitPercent: 80,
      fundedPayoutCycleDays: 14,
      fundedMinProfitForPayout: 100,
    }
  })

  const watchedFirm = watch('propFirmName')
  const watchedEvalType = watch('evaluationType')

  useEffect(() => {
    if (!watchedFirm || !watchedEvalType || !templates[watchedFirm]) return

    const program = templates[watchedFirm]?.programs?.find((p: any) => p.evaluationType === watchedEvalType)
    if (!program) return

    const { phase1, phase2, funded } = program.phases


    if (phase1) {
      setValue('phase1ProfitTargetPercent', phase1.profitTargetPercent)
      setValue('phase1DailyDrawdownPercent', phase1.dailyDrawdownPercent)
      setValue('phase1MaxDrawdownPercent', phase1.maxDrawdownPercent)
      setValue('phase1MaxDrawdownType', phase1.maxDrawdownType)
      setValue('phase1MinTradingDays', phase1.minTradingDays || 0)
      setValue('phase1TimeLimitDays', phase1.timeLimitDays || null)
    }


    if (phase2) {
      setValue('phase2ProfitTargetPercent', phase2.profitTargetPercent)
      setValue('phase2DailyDrawdownPercent', phase2.dailyDrawdownPercent)
      setValue('phase2MaxDrawdownPercent', phase2.maxDrawdownPercent)
      setValue('phase2MaxDrawdownType', phase2.maxDrawdownType)
      setValue('phase2MinTradingDays', phase2.minTradingDays || 0)
      setValue('phase2TimeLimitDays', phase2.timeLimitDays || null)
    }


    if (funded) {
      setValue('fundedDailyDrawdownPercent', funded.dailyDrawdownPercent)
      setValue('fundedMaxDrawdownPercent', funded.maxDrawdownPercent)
      setValue('fundedMaxDrawdownType', funded.maxDrawdownType)
      setValue('fundedProfitSplitPercent', funded.profitSplitPercent)
      setValue('fundedPayoutCycleDays', funded.payoutCycleDays || 14)
      setValue('fundedMinProfitForPayout', funded.minProfitForPayout || 100)
    }
  }, [watchedFirm, watchedEvalType, templates, setValue])

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

  const firms = Object.keys(templates)
  const programs = watchedFirm && templates[watchedFirm]?.programs?.map((p: any) => p.evaluationType) || []
  const sizes = watchedFirm && templates[watchedFirm]?.accountSizes || []

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
        <DialogContent className="w-full max-w-3xl max-h-[90vh] overflow-y-auto" data-tour="create-account-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Create Prop Firm Account
            </DialogTitle>
            <DialogDescription>
              Add a new prop firm evaluation account
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
            {}
            <Card>
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="accountName">Account Name *</Label>
                  <Input
                    id="accountName"
                    data-tour="account-name-input"
                    {...register('accountName')}
                    placeholder="e.g., FTMO 100K Challenge"
                  />
                  {errors.accountName && (
                    <p className="text-sm text-destructive mt-1">{errors.accountName.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="propFirmName">Prop Firm *</Label>
                    <Controller
                      name="propFirmName"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value}>
                          <SelectTrigger data-tour="account-broker-select">
                            <SelectValue placeholder="Select firm" />
                          </SelectTrigger>
                          <SelectContent>
                            {firms.map(firm => (
                              <SelectItem key={firm} value={firm}>{firm}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.propFirmName && (
                      <p className="text-sm text-destructive mt-1">{errors.propFirmName.message}</p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="evaluationType">Program *</Label>
                    <Controller
                      name="evaluationType"
                      control={control}
                      render={({ field }) => (
                        <Select onValueChange={field.onChange} value={field.value} disabled={!watchedFirm}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {programs.map((prog: string) => (
                              <SelectItem key={prog} value={prog}>{prog}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="accountSize">Account Size *</Label>
                    <Controller
                      name="accountSize"
                      control={control}
                      render={({ field }) => (
                        <Select
                          onValueChange={(val) => field.onChange(Number(val))}
                          value={field.value?.toString()}
                          disabled={!watchedFirm}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {sizes.map((size: number) => (
                              <SelectItem key={size} value={size.toString()}>
                                ${size.toLocaleString()}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>

                  <div>
                    <Label htmlFor="phase1AccountId">Phase 1 Account ID *</Label>
                    <Input
                      id="phase1AccountId"
                      {...register('phase1AccountId')}
                      placeholder="e.g., 12345678"
                    />
                    {errors.phase1AccountId && (
                      <p className="text-sm text-destructive mt-1">{errors.phase1AccountId.message}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                <div>
                  <CardTitle>Rules Summary</CardTitle>
                  <CardDescription>
                    {isEditingRules ? 'Edit rules as needed' : 'Review automatically loaded rules'}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  variant="tertiary"
                  size="sm"
                  onClick={() => setIsEditingRules(!isEditingRules)}
                  className="h-8 w-8 p-0"
                >
                  {isEditingRules ? (
                    <Check className="h-4 w-4 text-profit" />
                  ) : (
                    <PenLine className="h-4 w-4" />
                  )}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {}
                <div>
                  <Label className="text-sm font-medium mb-2 block">Phase 1</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Profit Target (%)</Label>
                      {isEditingRules ? (
                        <Controller
                          name="phase1ProfitTargetPercent"
                          control={control}
                          render={({ field }) => (
                            <PercentageField
                              aria-label="Phase 1 profit target"
                              aria-invalid={errors.phase1ProfitTargetPercent ? true : undefined}
                              value={field.value}
                              onValueChange={field.onChange}
                              className="h-9 mt-1"
                            />
                          )}
                        />
                      ) : (
                        <p className="font-semibold mt-1">{watch('phase1ProfitTargetPercent')}%</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Daily DD (%)</Label>
                      {isEditingRules ? (
                        <Controller
                          name="phase1DailyDrawdownPercent"
                          control={control}
                          render={({ field }) => (
                            <PercentageField
                              aria-label="Phase 1 daily drawdown"
                              aria-invalid={errors.phase1DailyDrawdownPercent ? true : undefined}
                              value={field.value}
                              onValueChange={field.onChange}
                              className="h-9 mt-1"
                            />
                          )}
                        />
                      ) : (
                        <p className="font-semibold mt-1">{watch('phase1DailyDrawdownPercent')}%</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max DD (%)</Label>
                      {isEditingRules ? (
                        <Controller
                          name="phase1MaxDrawdownPercent"
                          control={control}
                          render={({ field }) => (
                            <PercentageField
                              aria-label="Phase 1 max drawdown"
                              aria-invalid={errors.phase1MaxDrawdownPercent ? true : undefined}
                              value={field.value}
                              onValueChange={field.onChange}
                              className="h-9 mt-1"
                            />
                          )}
                        />
                      ) : (
                        <p className="font-semibold mt-1">{watch('phase1MaxDrawdownPercent')}%</p>
                      )}
                    </div>
                  </div>
                  {isEditingRules && (
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">DD Type</Label>
                        <Controller
                          name="phase1MaxDrawdownType"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-9 mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="static">Static</SelectItem>
                                <SelectItem value="trailing">Trailing</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Min Trading Days</Label>
                        <Input
                          type="number"
                          {...register('phase1MinTradingDays', { valueAsNumber: true })}
                          className="h-9 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Time Limit (days)</Label>
                        <Input
                          type="number"
                          {...register('phase1TimeLimitDays', { valueAsNumber: true })}
                          className="h-9 mt-1"
                          placeholder="Unlimited"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {}
                {watchedEvalType === 'Two Step' && (
                  <div className="pt-3 border-t">
                    <Label className="text-sm font-medium mb-2 block">Phase 2</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label className="text-xs text-muted-foreground">Profit Target (%)</Label>
                        {isEditingRules ? (
                          <Controller
                            name="phase2ProfitTargetPercent"
                            control={control}
                            render={({ field }) => (
                              <PercentageField
                                aria-label="Phase 2 profit target"
                                aria-invalid={errors.phase2ProfitTargetPercent ? true : undefined}
                                value={field.value}
                                onValueChange={field.onChange}
                                className="h-9 mt-1"
                              />
                            )}
                          />
                        ) : (
                          <p className="font-semibold mt-1">{watch('phase2ProfitTargetPercent')}%</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Daily DD (%)</Label>
                        {isEditingRules ? (
                          <Controller
                            name="phase2DailyDrawdownPercent"
                            control={control}
                            render={({ field }) => (
                              <PercentageField
                                aria-label="Phase 2 daily drawdown"
                                aria-invalid={errors.phase2DailyDrawdownPercent ? true : undefined}
                                value={field.value}
                                onValueChange={field.onChange}
                                className="h-9 mt-1"
                              />
                            )}
                          />
                        ) : (
                          <p className="font-semibold mt-1">{watch('phase2DailyDrawdownPercent')}%</p>
                        )}
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Max DD (%)</Label>
                        {isEditingRules ? (
                          <Controller
                            name="phase2MaxDrawdownPercent"
                            control={control}
                            render={({ field }) => (
                              <PercentageField
                                aria-label="Phase 2 max drawdown"
                                aria-invalid={errors.phase2MaxDrawdownPercent ? true : undefined}
                                value={field.value}
                                onValueChange={field.onChange}
                                className="h-9 mt-1"
                              />
                            )}
                          />
                        ) : (
                          <p className="font-semibold mt-1">{watch('phase2MaxDrawdownPercent')}%</p>
                        )}
                      </div>
                    </div>
                    {isEditingRules && (
                      <div className="grid grid-cols-3 gap-4 mt-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">DD Type</Label>
                          <Controller
                            name="phase2MaxDrawdownType"
                            control={control}
                            render={({ field }) => (
                              <Select onValueChange={field.onChange} {...(field.value ? { value: field.value } : {})}>
                                <SelectTrigger className="h-9 mt-1">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="static">Static</SelectItem>
                                  <SelectItem value="trailing">Trailing</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Min Trading Days</Label>
                          <Input
                            type="number"
                            {...register('phase2MinTradingDays', { valueAsNumber: true })}
                            className="h-9 mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">Time Limit (days)</Label>
                          <Input
                            type="number"
                            {...register('phase2TimeLimitDays', { valueAsNumber: true })}
                            className="h-9 mt-1"
                            placeholder="Unlimited"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {}
                <div className="pt-3 border-t">
                  <Label className="text-sm font-medium mb-2 block">Funded Account</Label>
                  <div className="grid grid-cols-4 gap-4">
                    <div>
                      <Label className="text-xs text-muted-foreground">Profit Split (%)</Label>
                      <Label className="text-xs text-muted-foreground">Profit Split (%)</Label>
                      {isEditingRules ? (
                        <Controller
                          name="fundedProfitSplitPercent"
                          control={control}
                          render={({ field }) => (
                            <PercentageField
                              aria-label="Funded profit split"
                              aria-invalid={errors.fundedProfitSplitPercent ? true : undefined}
                              value={field.value}
                              onValueChange={field.onChange}
                              className="h-9 mt-1"
                            />
                          )}
                        />
                      ) : (
                        <p className="font-semibold mt-1">{watch('fundedProfitSplitPercent')}%</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Payout Cycle (days)</Label>
                      {isEditingRules ? (
                        <Input
                          type="number"
                          {...register('fundedPayoutCycleDays', { valueAsNumber: true })}
                          className="h-9 mt-1"
                        />
                      ) : (
                        <p className="font-semibold mt-1">{watch('fundedPayoutCycleDays')} days</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Min Payout ($)</Label>
                      <Label className="text-xs text-muted-foreground">Min Payout ($)</Label>
                      {isEditingRules ? (
                        <Controller
                          name="fundedMinProfitForPayout"
                          control={control}
                          render={({ field }) => (
                            <CurrencyField
                              aria-label="Minimum payout amount"
                              aria-invalid={errors.fundedMinProfitForPayout ? true : undefined}
                              value={field.value}
                              onValueChange={field.onChange}
                              className="h-9 mt-1"
                              placeholder="100"
                            />
                          )}
                        />
                      ) : (
                        <p className="font-semibold mt-1">${watch('fundedMinProfitForPayout')}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">Max DD (%)</Label>
                      <Label className="text-xs text-muted-foreground">Max DD (%)</Label>
                      {isEditingRules ? (
                        <Controller
                          name="fundedMaxDrawdownPercent"
                          control={control}
                          render={({ field }) => (
                            <PercentageField
                              aria-label="Funded max drawdown"
                              aria-invalid={errors.fundedMaxDrawdownPercent ? true : undefined}
                              value={field.value}
                              onValueChange={field.onChange}
                              className="h-9 mt-1"
                            />
                          )}
                        />
                      ) : (
                        <p className="font-semibold mt-1">{watch('fundedMaxDrawdownPercent')}%</p>
                      )}
                    </div>
                  </div>
                  {isEditingRules && (
                    <div className="grid grid-cols-3 gap-4 mt-3">
                      <div>
                        <Label className="text-xs text-muted-foreground">DD Type</Label>
                        <Controller
                          name="fundedMaxDrawdownType"
                          control={control}
                          render={({ field }) => (
                            <Select onValueChange={field.onChange} value={field.value}>
                              <SelectTrigger className="h-9 mt-1">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="static">Static</SelectItem>
                                <SelectItem value="trailing">Trailing</SelectItem>
                              </SelectContent>
                            </Select>
                          )}
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-muted-foreground">Daily DD (%)</Label>
                        <Controller
                          name="fundedDailyDrawdownPercent"
                          control={control}
                          render={({ field }) => (
                            <PercentageField
                              aria-label="Funded daily drawdown"
                              aria-invalid={errors.fundedDailyDrawdownPercent ? true : undefined}
                              value={field.value}
                              onValueChange={field.onChange}
                              className="h-9 mt-1"
                            />
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {isEditingRules && (
                  <div className="pt-3 border-t">
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      <AlertCircle className="h-3 w-3" />
                      Changes will be saved when you create the account
                    </p>
                  </div>
                )}
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
