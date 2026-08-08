import { HugeiconsIcon } from '@hugeicons/react'
import { HeartIcon } from '@hugeicons/core-free-icons'
import { DonateCardsClient } from './donate-cards-client'

export const metadata = {
  title: 'Donate',
  description: 'Support the ongoing development of JJI.'
}

export default function DonatePage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
      {          }
      <div className="text-center space-y-3 mb-10">
        <div className="inline-flex items-center justify-center p-4 rounded-full bg-primary/10 mb-2">
          <HugeiconsIcon icon={HeartIcon} className="h-10 w-10 text-primary" strokeWidth={2} color="currentColor" />
        </div>
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">Support JJI</h1>
        <p className="text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
          Donations help support the ongoing development of JJI, keeping the product
          stable, improving, and adding new features for the trading community.
        </p>
        <p className="text-sm text-muted-foreground max-w-2xl mx-auto">
          Choose a wallet below, copy the address, and send from your preferred network.
        </p>
      </div>

      {                             }
      <DonateCardsClient />

      {            }
      <div className="mt-12 border-t pt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Thank you for helping keep JJI available to traders who need it.
        </p>
      </div>
    </div>
  )
}
