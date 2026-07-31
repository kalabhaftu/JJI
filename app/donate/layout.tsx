import { ReactNode } from 'react'

import { PublicShell } from '@/components/layouts/public-shell'
import { filterSupportNavItems, getSiteUiSettings } from '@/server/site-ui-settings'

export default async function DonateLayout({ children }: { children: ReactNode }) {
  const siteUiSettings = await getSiteUiSettings()

  return (
    <PublicShell
      activeHref="/donate"
      navItems={filterSupportNavItems([
        { href: '/docs', label: 'Docs' },
        { href: '/feedback', label: 'Feedback' },
      ], siteUiSettings)}
      headerContainerClassName="max-w-6xl"
      mainClassName="max-w-5xl"
    >
      {children}
    </PublicShell>
  )
}
