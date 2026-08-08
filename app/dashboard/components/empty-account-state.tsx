'use client';

import { HugeiconsIcon } from '@hugeicons/react';
import { WalletCardsIcon } from '@hugeicons/core-free-icons';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { resolveNavigationPath } from '@/lib/navigation/registry';
import { useData } from '@/context/data-provider';

interface EmptyAccountStateProps {
  onOpenAccountSelector?: () => void;
}

export function EmptyAccountState({ onOpenAccountSelector }: EmptyAccountStateProps) {
  const { isDemoMode } = useData();
  const handleSelectAccount = () => {
    if (onOpenAccountSelector) {
      onOpenAccountSelector();
    } else {
      window.dispatchEvent(new Event('open-account-selector'));
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="mb-5 flex items-center justify-center rounded-full bg-muted p-4">
        <HugeiconsIcon icon={WalletCardsIcon} className="h-8 w-8 text-muted-foreground" strokeWidth={1.5} color="currentColor" />
      </div>
      <h3 className="mb-2 text-xl font-semibold tracking-tight">Choose an account</h3>
      <p className="mb-8 max-w-sm text-sm text-muted-foreground">
        Choose a trading account to view performance data. Create one first if you have not set up your portfolio yet.
      </p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={handleSelectAccount}>Select Account</Button>
        <Button variant="secondary" asChild>
          <Link href={resolveNavigationPath('accounts', { surface: isDemoMode ? 'demo' : 'authenticated', isDemo: Boolean(isDemoMode) })}>Create Account</Link>
        </Button>
      </div>
    </div>
  );
}
