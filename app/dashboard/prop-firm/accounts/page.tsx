'use client'

import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Spinner } from "@/components/ui/spinner"

export const dynamic = 'force-dynamic'

export default function PropFirmAccountsPage() {
  const router = useRouter()

  useEffect(() => {
    router.push('/dashboard/accounts?filter=prop-firm')
  }, [router])

  return (
    <div className="flex items-center justify-center h-64">
      <Spinner className="h-8 w-8 text-primary" />
    </div>
  )
}
