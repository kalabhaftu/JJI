'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from 'sonner'
import { Plus, Minus, DollarSign } from "lucide-react"

const transactionSchema = z.object({
  type: z.enum(['DEPOSIT', 'WITHDRAWAL']),
  amount: z.string().min(1, 'Amount is required'),
  description: z.string().optional()
}).refine((data) => {
  const amount = parseFloat(data.amount)
  if (data.type === 'DEPOSIT' && amount < 5) {
    return false
  }
  if (data.type === 'WITHDRAWAL' && amount < 10) {
    return false
  }
  return true
}, {
  message: "Deposit minimum: $5, Withdrawal minimum: $10",
  path: ["amount"]
})

type TransactionFormData = z.infer<typeof transactionSchema>

interface TransactionDialogProps {
  accountId: string
  accountNumber: string
  currentBalance: number
  onTransactionComplete: () => void
  children: React.ReactNode
}

export function TransactionDialog({
  accountId,
  accountNumber,
  currentBalance,
  onTransactionComplete,
  children
}: TransactionDialogProps) {
  const [open, setOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionSchema),
    defaultValues: {
      type: 'DEPOSIT',
      amount: '',
      description: ''
    }
  })

  const watchedType = form.watch('type')

  const onSubmit = async (data: TransactionFormData) => {
    setIsLoading(true)
    try {
      const response = await fetch(`/api/v1/live-accounts/${accountId}/transactions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: data.type,
          amount: parseFloat(data.amount),
          description: data.description || null
        })
      })

      const result = await response.json()

      if (!result.success) {
        throw new Error(result.error || 'Transaction failed')
      }

      toast.success(
        `${data.type === 'DEPOSIT' ? 'Deposit' : 'Withdrawal'} Successful`,
        {
          description: `$${data.amount} ${data.type === 'DEPOSIT' ? 'deposited to' : 'withdrawn from'} account ${accountNumber}`
        }
      )

      form.reset()
      setOpen(false)
      onTransactionComplete()
    } catch (error) {
      toast.error('Transaction Failed', {
        description: error instanceof Error ? error.message : 'An unexpected error occurred'
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {watchedType === 'DEPOSIT' ? (
              <Plus className="w-5 h-5 text-long" />
            ) : (
              <Minus className="w-5 h-5 text-short" />
            )}
            {watchedType === 'DEPOSIT' ? 'Deposit Funds' : 'Withdraw Funds'}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Transaction Type</Label>
            <Select
              value={form.watch('type')}
              onValueChange={(value) => form.setValue('type', value as 'DEPOSIT' | 'WITHDRAWAL')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DEPOSIT">
                  <div className="flex items-center gap-2">
                    <Plus className="w-4 h-4 text-long" />
                    Deposit
                  </div>
                </SelectItem>
                <SelectItem value="WITHDRAWAL">
                  <div className="flex items-center gap-2">
                    <Minus className="w-4 h-4 text-short" />
                    Withdrawal
                  </div>
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                id="amount"
                type="number"
                step="0.01"
                min={watchedType === 'DEPOSIT' ? 5 : 10}
                placeholder={watchedType === 'DEPOSIT' ? '5.00' : '10.00'}
                className="pl-10"
                {...form.register('amount')}
              />
            </div>
            <p className="text-sm text-muted-foreground">
              {watchedType === 'DEPOSIT'
                ? 'Minimum deposit: $5.00'
                : `Minimum withdrawal: $10.00 (Current balance: $${currentBalance.toFixed(2)})`
              }
            </p>
            {form.formState.errors.amount && (
              <p className="text-sm text-short">{form.formState.errors.amount.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Add a note about this transaction..."
              {...form.register('description')}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className={watchedType === 'DEPOSIT' ? 'bg-long hover:bg-long/90 text-long-foreground' : 'bg-short hover:bg-short/90 text-short-foreground'}
            >
              {isLoading ? 'Processing...' : `${watchedType === 'DEPOSIT' ? 'Deposit' : 'Withdraw'}`}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
