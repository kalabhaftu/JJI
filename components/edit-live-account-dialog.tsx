'use client'

import { useState, useEffect } from 'react'
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from 'zod'
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  User
} from "lucide-react"

const editAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').max(100, 'Name too long'),
  broker: z.string().min(1, 'Broker is required').max(100, 'Broker name too long'),
  number: z.string().min(1, 'Account number is required').max(50, 'Number too long'),
  startingBalance: z.string().min(1, 'Starting balance is required'),
})

type EditAccountForm = z.infer<typeof editAccountSchema>

interface LiveAccountData {
  id: string
  number: string
  name?: string
  broker?: string
  displayName?: string
  startingBalance?: number
  status?: string
  accountType?: 'live' | 'prop-firm'
  isConfigured?: boolean
}

interface EditLiveAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: LiveAccountData | null
  onSuccess?: () => void
}

export function EditLiveAccountDialog({
  open,
  onOpenChange,
  account,
  onSuccess
}: EditLiveAccountDialogProps) {
  const [isSaving, setIsSaving] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue
  } = useForm<EditAccountForm>({
    resolver: zodResolver(editAccountSchema)
  })

  useEffect(() => {
    if (account && open) {
      setValue('name', account.name || account.displayName || account.number)
      setValue('broker', account.broker || '')
      setValue('number', account.number || '')
      setValue('startingBalance', (account.startingBalance || 0).toString())
    }
  }, [account, open, setValue])

  const onSubmit = async (data: EditAccountForm) => {
    if (!account) return

    try {
      setIsSaving(true)

      const response = await fetch(`/api/v1/accounts/${account.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.name.trim(),
          broker: data.broker.trim(),
          number: data.number.trim(),
          startingBalance: data.startingBalance
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update account')
      }

      toast('Account Updated', {
        description: 'Your account has been successfully updated.',
      })

      onOpenChange(false)
      onSuccess?.()

    } catch (error) {
      toast('Update Failed', {
        description: error instanceof Error ? error.message : 'Failed to update account',
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    reset()
    onOpenChange(false)
  }

  if (!account) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Edit Account
          </DialogTitle>
          <DialogDescription>
            Update your live account settings. {account.isConfigured ? 'Changes will be saved immediately.' : 'Configure your default account details.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Account Name *</Label>
            <Input
              id="name"
              placeholder="Enter account name"
              {...register('name')}
              disabled={isSaving}
            />
            {errors.name && (
              <p className="text-sm text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="broker">Broker *</Label>
            <Input
              id="broker"
              placeholder="Enter broker name"
              {...register('broker')}
              disabled={isSaving}
            />
            {errors.broker && (
              <p className="text-sm text-destructive">{errors.broker.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="number">Account Number *</Label>
            <Input
              id="number"
              placeholder="Enter account number"
              {...register('number')}
              disabled={isSaving || account.isConfigured}
              className={account.isConfigured ? "bg-muted" : ""}
            />
            {errors.number && (
              <p className="text-sm text-destructive">{errors.number.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {account.isConfigured 
                ? "Account number cannot be changed" 
                : "Enter your account number. This can only be set once."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="startingBalance">Starting Balance ($) *</Label>
            <Input
              id="startingBalance"
              type="number"
              step="0.01"
              placeholder="0.00"
              {...register('startingBalance')}
              disabled={isSaving || account.isConfigured}
              className={account.isConfigured ? "bg-muted" : ""}
            />
            {errors.startingBalance && (
              <p className="text-sm text-destructive">{errors.startingBalance.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {account.isConfigured 
                ? "Starting balance cannot be changed" 
                : "Enter your initial balance. This can only be set once."}
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={handleCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving && <Spinner className="mr-2 h-4 w-4" />}
              {account.isConfigured ? 'Save Changes' : 'Confirm Setup'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
