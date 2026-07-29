'use client'

import { useCallback } from 'react'
import type { PayoutType } from '@/lib/db/schema'
import { handleServerActionError } from '@/lib/utils/server-action-error-handler'
import type { Account } from '@/context/data-provider/types'
import { apiRequest } from '@/lib/api/client'

type Params = {
  userId: string | undefined
  accounts: Account[]
  setAccounts: (accounts: Account[]) => void
}

export function useDataProviderAccountActions({ userId, accounts, setAccounts }: Params) {
  const saveAccount = useCallback(async (newAccount: Account) => {
    if (!userId) return

    const currentAccount = accounts.find(
      (account) => account.id === newAccount.id
        || account.number === newAccount.number,
    )
    const endpoint = currentAccount?.id
      ? `/api/v1/accounts/${encodeURIComponent(currentAccount.id)}`
      : '/api/v1/accounts'
    const response = await apiRequest<Account>(endpoint, {
      method: currentAccount ? 'PATCH' : 'POST',
      body: JSON.stringify({
        name: newAccount.displayName || newAccount.name || newAccount.number,
        number: newAccount.number,
        startingBalance: newAccount.startingBalance ?? 0,
        broker: newAccount.broker || 'Other',
        isArchived: newAccount.isArchived ?? false,
      }),
    })
    const savedAccount = response.data
    if (!savedAccount) return

    if (!currentAccount) {
      setAccounts([...accounts, savedAccount as Account])
    } else {
      setAccounts(accounts.map((account) => account.id === savedAccount.id
        || account.number === currentAccount.number
        ? { ...account, ...savedAccount } as Account
        : account))
    }
  }, [accounts, setAccounts, userId])

  const savePayout = useCallback(async (payout: PayoutType) => {
    if (!userId) return

    const payload: any = { ...payout }
    if (payload.requestDate === undefined) delete payload.requestDate
    if (payload.notes === undefined) delete payload.notes

    const response = await apiRequest<PayoutType>('/api/v1/prop-firm/payouts', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    const newPayout = response.data
    if (!newPayout) return
    setAccounts(accounts.map((account) => account.id === payout.masterAccountId || (account as any).number === (payout as any).accountNumber
      ? { ...account, payouts: [...(account.payouts || []), newPayout] } as Account
      : account))
  }, [accounts, setAccounts, userId])

  const deleteAccount = useCallback(async (account: Account) => {
    if (!userId) return

    setAccounts(accounts.filter((item) => item.id !== account.id))
    try {
      if (account.accountType === 'prop-firm') {
        const masterAccountId = account.currentPhaseDetails?.masterAccountId
          ?? account.id
        await apiRequest(
          `/api/v1/prop-firm/accounts/${encodeURIComponent(masterAccountId)}`,
          { method: 'DELETE' },
        )
      } else {
        await apiRequest(
          `/api/v1/accounts/${encodeURIComponent(account.id)}`,
          { method: 'DELETE' },
        )
      }
    } catch (error) {
      setAccounts(accounts)
      if (handleServerActionError(error, { context: 'Delete Account' })) return
      throw error
    }
  }, [accounts, setAccounts, userId])

  const deletePayout = useCallback(async (payoutId: string) => {
    if (!userId) return

    setAccounts(accounts.map((account) => ({
      ...account,
      payouts: account.payouts?.filter((payout) => payout.id !== payoutId) || [],
    })))
    try {
      await apiRequest(
        `/api/v1/prop-firm/payouts/${encodeURIComponent(payoutId)}`,
        { method: 'DELETE' },
      )
    } catch (error) {
      setAccounts(accounts)
      if (handleServerActionError(error, { context: 'Delete Payout' })) return
      throw error
    }
  }, [accounts, setAccounts, userId])

  return { saveAccount, savePayout, deleteAccount, deletePayout }
}
