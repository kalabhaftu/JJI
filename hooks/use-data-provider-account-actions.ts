'use client'

import { useCallback } from 'react'
import type { PayoutType } from '@/lib/db/schema'
import {
  deleteAccountAction,
  deleteMasterAccountAction,
  deletePayoutAction,
  savePayoutAction,
  setupAccountAction,
} from '@/server/accounts'
import { revalidateCache } from '@/server/database'
import { handleServerActionError } from '@/lib/utils/server-action-error-handler'
import type { Account } from '@/context/data-provider/types'

type Params = {
  userId: string | undefined
  accounts: Account[]
  setAccounts: (accounts: Account[]) => void
}

export function useDataProviderAccountActions({ userId, accounts, setAccounts }: Params) {
  const saveAccount = useCallback(async (newAccount: Account) => {
    if (!userId) return

    const currentAccount = accounts.find((account) => account.number === newAccount.number)
    const savedAccount = await setupAccountAction(newAccount)
    if (!savedAccount) return

    if (!currentAccount) {
      setAccounts([...accounts, savedAccount as Account])
    } else {
      setAccounts(accounts.map((account) => account.number === savedAccount.number
        ? { ...account, ...savedAccount } as Account
        : account))
    }
    await revalidateCache([`user-data-${userId}`])
  }, [accounts, setAccounts, userId])

  const savePayout = useCallback(async (payout: PayoutType) => {
    if (!userId) return

    const payload: any = { ...payout }
    if (payload.requestDate === undefined) delete payload.requestDate
    if (payload.notes === undefined) delete payload.notes

    const newPayout = await savePayoutAction(payload)
    setAccounts(accounts.map((account) => account.id === payout.masterAccountId || (account as any).number === (payout as any).accountNumber
      ? { ...account, payouts: [...(account.payouts || []), newPayout] } as Account
      : account))
  }, [accounts, setAccounts, userId])

  const deleteAccount = useCallback(async (account: Account) => {
    if (!userId) return

    setAccounts(accounts.filter((item) => item.id !== account.id))
    try {
      if (account.accountType === 'prop-firm') {
        await deleteMasterAccountAction(account.id)
      } else {
        await deleteAccountAction(account.id)
      }
    } catch (error) {
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
      await deletePayoutAction(payoutId)
    } catch (error) {
      if (handleServerActionError(error, { context: 'Delete Payout' })) return
      throw error
    }
  }, [accounts, setAccounts, userId])

  return { saveAccount, savePayout, deleteAccount, deletePayout }
}
