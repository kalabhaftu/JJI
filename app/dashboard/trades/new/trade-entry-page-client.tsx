'use client'

import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useRouter, useSearchParams } from 'next/navigation'
import { TradeWorkspace } from '@/components/ui/trade-workspace'
import ManualTradeForm from '@/app/dashboard/components/import/manual-trade-entry/manual-trade-form'
import { useUserStore } from '@/store/user-store'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys } from '@/lib/query/query-keys'
import { isScopeReady, useQueryScope } from '@/lib/query/use-query-scope'
import { clearTradeEntryDraft, loadTradeEntryDraft, parseTradeEntryRouteState, saveTradeEntryDraft } from './trade-entry-draft'
import type { TradeEntryDraft } from './trade-entry-draft'
import type { TradeEntryFormValues } from './trade-entry-schema'
import { Button } from '@/components/ui/button'

export default function TradeEntryPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useUserStore((state) => state.user || state.supabaseUser)
  const scope = useQueryScope()
  const state = useMemo(() => parseTradeEntryRouteState(searchParams), [searchParams])
  const propFirmAccountId = state.propFirmAccountId
  const accountQuery = useQuery({
    queryKey: queryKeys.propFirmAccount(scope, propFirmAccountId ?? ''),
    queryFn: ({ signal }) => apiRequestData<{ account: { id: string } }>(`/api/v1/prop-firm/accounts/${propFirmAccountId}`, { signal, operation: 'load-prop-firm-account-for-trade-entry' }),
    enabled: Boolean(user?.id && propFirmAccountId && isScopeReady(scope)),
    staleTime: 30_000,
  })
  const draftId = state.draftId ?? 'default'
  const [values, setValues] = useState<Partial<TradeEntryFormValues>>(() => state.accountId ? { accountNumber: state.accountId } : {})
  const [saved, setSaved] = useState(false)
  const returnTo = state.returnTo || '/dashboard/table'
  const close = () => router.push(returnTo)

  useEffect(() => { if (user?.id) { const draft = loadTradeEntryDraft(user.id, draftId); if (draft) setValues(draft.values) } }, [draftId, user?.id])
  useEffect(() => {
    if (!user?.id || Object.keys(values).length === 0) return
    const draft: TradeEntryDraft = { version: 1, userId: user.id, draftId, updatedAt: Date.now(), values }
    if (state.origin) draft.origin = state.origin
    if (state.accountId) draft.accountId = state.accountId
    if (state.propFirmAccountId) draft.propFirmAccountId = state.propFirmAccountId
    if (state.phaseId) draft.phaseId = state.phaseId
    saveTradeEntryDraft(draft)
  }, [draftId, state.accountId, state.origin, state.phaseId, state.propFirmAccountId, user?.id, values])
  useEffect(() => {
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      if (Object.keys(values).length > 0 && !saved) { event.preventDefault(); event.returnValue = '' }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [saved, values])

  const discard = () => { if (user?.id) clearTradeEntryDraft(user.id, draftId) }
  const handleValuesChange = (next: Partial<TradeEntryFormValues>) => setValues((previous) => JSON.stringify(previous) === JSON.stringify(next) ? previous : next)
  const form = <ManualTradeForm initialValues={values as never} onValuesChange={handleValuesChange} onSuccess={() => { if (user?.id) clearTradeEntryDraft(user.id, draftId); setSaved(true) }} onClose={close} />
  const savedState = <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"><h2 className="text-2xl font-semibold">Trade saved</h2><p className="text-muted-foreground">Your trade was added to the journal.</p><Button onClick={close}>Return to trades</Button></div>
  const accountUnavailable = <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"><h2 className="text-2xl font-semibold">Account not found or inaccessible</h2><p className="text-muted-foreground">The account you're looking for doesn't exist or you don't have access to it.</p><Button onClick={close}>Return to trades</Button></div>
  const accountLoading = <div aria-busy="true" className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"><p className="text-muted-foreground">Loading account...</p></div>
  return <TradeWorkspace mode="route" title="Add trade" description="Record and review a trade before saving." dirty={Object.keys(values).length > 0 && !saved} onRequestClose={close} onConfirmDiscard={discard} returnTo={returnTo}>
    {saved ? savedState : propFirmAccountId ? (accountQuery.isPending ? accountLoading : accountQuery.data ? form : accountUnavailable) : form}
  </TradeWorkspace>
}
