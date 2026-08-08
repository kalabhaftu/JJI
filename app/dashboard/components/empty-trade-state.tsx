'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { WalletCardsIcon } from '@hugeicons/core-free-icons';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { resolveNavigationPath } from '@/lib/navigation/registry';
import { useData } from '@/context/data-provider';
import { useRouter } from 'next/navigation';
import { buildTradeEntryHref } from '@/app/dashboard/trades/new/trade-entry-draft';

export function EmptyTradeState({ variant = 'no-account' }: { variant?: 'no-account' | 'no-trades' | 'filtered' }) {
  const router = useRouter()
  const { isDemoMode } = useData()
  const isNoAccount = variant === 'no-account'
  const isFiltered = variant === 'filtered'

  const handleImport = () => window.dispatchEvent(new Event('open-import-modal'))
  const handleClearFilter = () => window.dispatchEvent(new Event('open-account-selector'))

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-5 flex items-center justify-center rounded-full bg-muted p-4">
        <HugeiconsIcon icon={WalletCardsIcon} className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} color="currentColor" />
      </div>
      <h3 className="mb-2 text-xl font-semibold tracking-tight">
        {isNoAccount ? 'Create a trading account first' : isFiltered ? 'No trades in this account scope' : 'Your workspace has no trades yet'}
      </h3>
      <p className="mb-8 max-w-sm text-sm text-muted-foreground">
        {isNoAccount
          ? 'JJI needs a portfolio to link trades to. Create one now, then import your history to unlock performance review.'
          : isFiltered
            ? 'The selected account or phase has no matching trades. Change the account filter or import history into this scope.'
            : 'Import your history or add a trade manually to start building performance evidence.'}
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        {isNoAccount ? (
          <Button asChild><Link href={resolveNavigationPath('accounts', { surface: isDemoMode ? 'demo' : 'authenticated', isDemo: Boolean(isDemoMode) })}>Create account</Link></Button>
        ) : isFiltered ? (
          <Button onClick={handleClearFilter}>Change account filter</Button>
        ) : (
          <Button onClick={() => router.push(buildTradeEntryHref({ origin: 'empty-state', returnTo: '/dashboard' }))}>Add trade manually</Button>
        )}
        <Button variant="secondary" onClick={handleImport}>{isNoAccount ? 'Import after setup' : 'Import trades'}</Button>
      </div>
    </div>
  );
}
