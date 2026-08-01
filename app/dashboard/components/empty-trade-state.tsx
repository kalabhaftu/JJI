'use client';

import { WalletCards } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useQuickAddStore } from '@/store/quick-add-store';

export function EmptyTradeState({ variant = 'no-account' }: { variant?: 'no-account' | 'no-trades' | 'filtered' }) {
  const openQuickAdd = useQuickAddStore((state) => state.openQuickAdd)
  const isNoAccount = variant === 'no-account'
  const isFiltered = variant === 'filtered'

  const handleImport = () => window.dispatchEvent(new Event('open-import-modal'))
  const handleClearFilter = () => window.dispatchEvent(new Event('open-account-selector'))

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-5 flex items-center justify-center rounded-full bg-muted p-4">
        <WalletCards className="h-8 w-8 text-muted-foreground" />
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
          <Button asChild><Link href="/dashboard/accounts">Create account</Link></Button>
        ) : isFiltered ? (
          <Button onClick={handleClearFilter}>Change account filter</Button>
        ) : (
          <Button onClick={openQuickAdd}>Add trade manually</Button>
        )}
        <Button variant="outline" onClick={handleImport}>{isNoAccount ? 'Import after setup' : 'Import trades'}</Button>
      </div>
    </div>
  );
}
