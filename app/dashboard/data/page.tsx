'use client'

import { useEffect, lazy, Suspense, useCallback } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { DataManagementCardSkeleton, DataPageSkeleton, DataTradeTableSkeleton } from "./components/data-page-skeleton"
import { PageHeader } from "@/components/ui/page-header"
import { Briefcase, Table } from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

export const dynamic = 'force-dynamic'

const TradeTable = lazy(() => import("@/app/dashboard/data/components/data-management/trade-table"))
const DataManagementCard = lazy(() => import("@/app/dashboard/data/components/data-management/data-management-card").then(mod => ({ default: mod.DataManagementCard })))

const categories = [
  { id: 'accounts', label: 'Accounts', icon: Briefcase },
  { id: 'trades', label: 'Trades', icon: Table },
]

function DashboardContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = searchParams.get('tab') || 'accounts'

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  const handleTabChange = useCallback((value: string) => {
    router.push(`/dashboard/data?tab=${value}`)
  }, [router])

  return (
    <div className="w-full max-w-7xl mx-auto py-8 px-4 sm:px-6 pb-20 md:pb-8">
      <div className="mb-8">
        <PageHeader title="Data Management" className="gap-2" />
      </div>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        <div className="w-full md:w-64 shrink-0 flex md:flex-col overflow-x-auto md:overflow-x-visible pb-3 md:pb-0 gap-1 border-b md:border-b-0 md:border-r border-border/40 pr-0 md:pr-4 scrollbar-none">
          {categories.map((cat) => {
            const Icon = cat.icon
            const isActive = activeTab === cat.id
            return (
              <button
                key={cat.id}
                onClick={() => handleTabChange(cat.id)}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap md:w-full text-left shrink-0",
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeDataTabIndicator"
                    className="absolute inset-0 bg-muted/65 rounded-lg -z-10"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground")} />
                <span className="truncate">{cat.label}</span>
              </button>
            )
          })}
        </div>

        <div className="flex-1 min-w-0 w-full">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-6"
          >
            {activeTab === 'accounts' ? (
              <Suspense fallback={<DataManagementCardSkeleton />}>
                <DataManagementCard />
              </Suspense>
            ) : (
              <Suspense fallback={<DataTradeTableSkeleton />}>
                <TradeTable />
              </Suspense>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<DataPageSkeleton />}>
      <DashboardContent />
    </Suspense>
  )
}
