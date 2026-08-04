import { Suspense } from 'react'
import { DashboardClient } from './dashboard-client'

export const metadata = {
  title: 'Dashboard',
  description: 'Your trading dashboard and widgets.'
}

export default function Home() {
  return (
    <Suspense fallback={null}>
      <DashboardClient />
    </Suspense>
  )
}
