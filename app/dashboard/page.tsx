import { Suspense } from 'react'
import { DashboardClient } from './dashboard-client'
import { DashboardLoadingSkeleton } from '@/components/ui/dashboard-skeleton'

export const metadata = {
  title: 'Dashboard',
  description: 'Your trading dashboard and widgets.'
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardLoadingSkeleton />}>
      <DashboardClient />
    </Suspense>
  )
}
