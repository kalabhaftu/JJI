'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TradeWorkspace } from '@/components/ui/trade-workspace'
import ManualTradeForm from '@/app/dashboard/components/import/manual-trade-entry/manual-trade-form'
import { useUserStore } from '@/store/user-store'
import { clearTradeEntryDraft, loadTradeEntryDraft, parseTradeEntryRouteState, saveTradeEntryDraft } from './trade-entry-draft'
import type { TradeEntryDraft } from './trade-entry-draft'
import type { TradeEntryFormValues } from './trade-entry-schema'
import { Button } from '@/components/ui/button'

export default function TradeEntryPageClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const user = useUserStore((state) => state.user || state.supabaseUser)
  const state = useMemo(() => parseTradeEntryRouteState(searchParams), [searchParams])
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
  return <TradeWorkspace mode="route" title="Add trade" description="Record and review a trade before saving." dirty={Object.keys(values).length > 0 && !saved} onRequestClose={close} onConfirmDiscard={discard} returnTo={returnTo}>
    {saved ? <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center"><h2 className="text-2xl font-semibold">Trade saved</h2><p className="text-muted-foreground">Your trade was added to the journal.</p><Button onClick={close}>Return to trades</Button></div> : <ManualTradeForm initialValues={values as never} onValuesChange={(next) => setValues(next as Partial<TradeEntryFormValues>)} onSuccess={() => { if (user?.id) clearTradeEntryDraft(user.id, draftId); setSaved(true) }} onClose={close} />}
  </TradeWorkspace>
}
