import { Suspense } from 'react'
import TradeEntryPageClient from './trade-entry-page-client'

export default function NewTradePage() {
  return <Suspense fallback={<div className="flex h-full items-center justify-center">Loading trade entry...</div>}><TradeEntryPageClient /></Suspense>
}
