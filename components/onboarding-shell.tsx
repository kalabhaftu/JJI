'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { HugeiconsIcon, type HugeiconsIconProps } from '@hugeicons/react'
import { DatabaseIcon, File01Icon, FileSpreadsheetIcon, Add01Icon, RefreshIcon, SparklesIcon, Delete02Icon, Upload01Icon, Wallet01Icon } from '@hugeicons/core-free-icons'
import { toast } from 'sonner'
import { apiRequestData } from '@/lib/api/client'
import { reportClientError } from '@/lib/observability/report-error'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useData } from '@/context/data-provider'
import { useTour } from '@/context/tour-context'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope } from '@/lib/query/use-query-scope'
import { downloadSampleTradesCsv } from '@/lib/tours/sample-csv'

type SetupView = 'welcome' | 'choice' | 'create'

export function OnboardingShell() {
  const { accounts } = useData()
  const queryClient = useQueryClient()
  const scope = useQueryScope()
  const {
    onboardingOpen,
    onboardingStatus,
    startSetup,
    setSetupMode,
    setSampleAccountId,
    completeSetup,
    skipSetup,
    cleanupError,
    retrySampleCleanup,
  } = useTour()
  const [view, setView] = useState<SetupView>('welcome')
  const [handoff, setHandoff] = useState(false)
  const [setupMode, setLocalSetupMode] = useState<'real_import' | 'sample_import'>('real_import')
  const [sampleAccountId, setLocalSampleAccountId] = useState<string | null>(null)
  const [isCreatingSample, setIsCreatingSample] = useState(false)
  const [isCreatingAccount, setIsCreatingAccount] = useState(false)
  const [accountForm, setAccountForm] = useState({ name: '', number: '', broker: '', startingBalance: '10000' })

  useEffect(() => {
    if (!onboardingOpen) return
    setLocalSetupMode(onboardingStatus?.setup_mode ?? 'real_import')
    setLocalSampleAccountId(onboardingStatus?.sample_account_id ?? null)
    if (onboardingStatus?.setup === 'in_progress' && onboardingStatus.setup_mode) setView('choice')
  }, [onboardingOpen, onboardingStatus?.sample_account_id, onboardingStatus?.setup, onboardingStatus?.setup_mode])

  useEffect(() => {
    const handleImportComplete = () => {
      if (!handoff) return
      setHandoff(false)
      void completeSetup(setupMode, sampleAccountId)
    }
    const handleImportClosed = () => {
      if (!handoff) return
      setHandoff(false)
      setView('choice')
    }
    document.addEventListener('jji-import-completed', handleImportComplete)
    document.addEventListener('jji-import-closed', handleImportClosed)
    return () => {
      document.removeEventListener('jji-import-completed', handleImportComplete)
      document.removeEventListener('jji-import-closed', handleImportClosed)
    }
  }, [completeSetup, handoff, sampleAccountId, setupMode])

  const hasAccounts = accounts.length > 0
  const modeLabel = useMemo(() => setupMode === 'sample_import' ? 'sample CSV' : 'your trades', [setupMode])

  const openImporter = () => {
    setHandoff(true)
    window.dispatchEvent(new Event('open-import-modal'))
  }

  const handleMode = async (mode: 'real_import' | 'sample_import') => {
    setLocalSetupMode(mode)
    await setSetupMode(mode)

    if (mode === 'real_import' && !hasAccounts) {
      setView('create')
      return
    }

    if (mode === 'sample_import') {
      setIsCreatingSample(true)
      try {
        downloadSampleTradesCsv()
        const data = await apiRequestData<{ id?: string }>('/api/v1/onboarding/sample-workspace', {
          method: 'POST',
          retry: { mode: 'never' },
          operation: 'create-sample-workspace',
        })
        if (!data.id) throw new Error('Could not create sample workspace')
        setLocalSampleAccountId(data.id)
        await setSampleAccountId(data.id)
        await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
        await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.dataManagementAccounts(scope) })
        openImporter()
      } catch (error) {
        reportClientError(error, { operation: 'create-sample-workspace', route: '/dashboard' })
        toast.error('Sample workspace unavailable', { description: error instanceof Error ? error.message : 'Try again.' })
      } finally {
        setIsCreatingSample(false)
      }
      return
    }

    openImporter()
  }

  const handleCreateAccount = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsCreatingAccount(true)
    try {
      const data = await apiRequestData<{ id: string }>('/api/v1/accounts', {
        method: 'POST',
        body: JSON.stringify({
          ...accountForm,
          startingBalance: Number(accountForm.startingBalance),
        }),
        retry: { mode: 'never' },
        operation: 'create-onboarding-account',
      })
      document.dispatchEvent(new CustomEvent('jji-account-created', { detail: { id: data.id, type: 'live' } }))
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.dataManagementAccounts(scope) })
      toast.success('Trading account created')
      openImporter()
    } catch (error) {
      reportClientError(error, { operation: 'create-onboarding-account', route: '/dashboard' })
      toast.error('Account could not be created', { description: error instanceof Error ? error.message : 'Check the fields and try again.' })
    } finally {
      setIsCreatingAccount(false)
    }
  }

  return (
    <>
      <Dialog open={onboardingOpen && !handoff} onOpenChange={(open) => { if (!open && !handoff) void skipSetup() }}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl" data-onboarding-layer>
          <DialogHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              {view === 'create' ? <HugeiconsIcon icon={Wallet01Icon} className="h-5 w-5" /> : <HugeiconsIcon icon={SparklesIcon} className="h-5 w-5"  strokeWidth={2}/>}
            </div>
            <DialogTitle className="text-2xl">{view === 'welcome' ? 'Welcome to JJI' : view === 'create' ? 'Create your first trading account' : 'Choose how to begin'}</DialogTitle>
            <DialogDescription>
              {view === 'welcome'
                ? 'Set up your workspace, bring in your trades, and learn the parts of JJI that matter to your review.'
                : view === 'create'
                  ? 'JJI needs a portfolio to link imported trades to. You can change these details later.'
                  : `Start with ${modeLabel}, then continue through the product tour at your pace.`}
            </DialogDescription>
          </DialogHeader>

          {view === 'welcome' && (
            <div className="space-y-5">
              <div className="grid gap-3 sm:grid-cols-3">
                {([
                  ['Import', 'Bring in broker or CSV history.', FileSpreadsheetIcon],
                  ['Review', 'See performance in context.', DatabaseIcon],
                  ['Improve', 'Turn patterns into decisions.', RefreshIcon],
                ] as Array<[string, string, HugeiconsIconProps['icon']]>).map(([title, copy, Icon]) => (
                  <div key={String(title)} className="rounded-lg border border-border bg-muted/20 p-3">
                    <HugeiconsIcon icon={Icon} className="mb-3 h-4 w-4 text-primary" strokeWidth={2} color="currentColor" />
                    <p className="text-sm font-medium">{title}</p>
                    <p className="mt-1 text-xs leading-5 text-muted-foreground">{copy}</p>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
                <Button variant="tertiary" onClick={() => void skipSetup()}>Skip for now</Button>
                <Button onClick={() => { startSetup(); setView('choice'); void setSetupMode('real_import') }}>Set up my workspace</Button>
              </div>
            </div>
          )}

          {view === 'choice' && (
            <div className="space-y-3">
              <button type="button" className="flex w-full items-start gap-4 rounded-xl border border-primary/40 bg-primary/5 p-4 text-left transition-colors hover:bg-primary/10" onClick={() => void handleMode('real_import')}>
                <HugeiconsIcon icon={Upload01Icon} className="mt-0.5 h-5 w-5 shrink-0 text-primary" strokeWidth={2} />
                <span><span className="block text-sm font-semibold">Import my trades</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">Use your own account and history to reach useful analytics immediately.</span></span>
              </button>
              <button type="button" className="flex w-full items-start gap-4 rounded-xl border border-border p-4 text-left transition-colors hover:bg-muted/40" onClick={() => void handleMode('sample_import')} disabled={isCreatingSample}>
                <HugeiconsIcon icon={File01Icon} className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" strokeWidth={2} />
                <span><span className="block text-sm font-semibold">Use a sample workspace</span><span className="mt-1 block text-sm leading-5 text-muted-foreground">JJI downloads a small CSV, creates a temporary workspace, and removes it after the core tour.</span></span>
              </button>
              <div className="flex justify-between border-t border-border pt-4"><Button variant="tertiary" onClick={() => setView('welcome')}>Back</Button><Button variant="tertiary" onClick={() => void skipSetup()}>Skip for now</Button></div>
            </div>
          )}

          {view === 'create' && (
            <form className="space-y-4" onSubmit={handleCreateAccount}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="onboarding-account-name">Account name</Label><Input id="onboarding-account-name" required value={accountForm.name} onChange={(event) => setAccountForm({ ...accountForm, name: event.target.value })} placeholder="My futures account" /></div>
                <div className="space-y-2"><Label htmlFor="onboarding-account-number">Account number</Label><Input id="onboarding-account-number" required value={accountForm.number} onChange={(event) => setAccountForm({ ...accountForm, number: event.target.value })} placeholder="123456" /></div>
                <div className="space-y-2"><Label htmlFor="onboarding-account-broker">Broker</Label><Input id="onboarding-account-broker" required value={accountForm.broker} onChange={(event) => setAccountForm({ ...accountForm, broker: event.target.value })} placeholder="Broker or platform" /></div>
                <div className="space-y-2"><Label htmlFor="onboarding-account-balance">Starting balance</Label><Input id="onboarding-account-balance" required type="number" min="0" value={accountForm.startingBalance} onChange={(event) => setAccountForm({ ...accountForm, startingBalance: event.target.value })} /></div>
              </div>
              <div className="flex justify-between border-t border-border pt-4"><Button type="button" variant="tertiary" onClick={() => setView('choice')}>Back</Button><Button type="submit" disabled={isCreatingAccount}><HugeiconsIcon icon={Add01Icon} className="mr-2 h-4 w-4"  strokeWidth={2}/>{isCreatingAccount ? 'Creating…' : 'Create account and import'}</Button></div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {cleanupError && (
        <div className="fixed bottom-4 right-4 z-[10000] flex max-w-sm items-center gap-3 rounded-lg border border-warning/30 bg-background p-4 shadow-xl" role="status">
          <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 shrink-0 text-warning-foreground" strokeWidth={2} />
          <p className="flex-1 text-sm text-muted-foreground">{cleanupError}</p>
          <Button size="sm" variant="secondary" onClick={() => void retrySampleCleanup()}>Retry</Button>
        </div>
      )}
    </>
  )
}

export default OnboardingShell
