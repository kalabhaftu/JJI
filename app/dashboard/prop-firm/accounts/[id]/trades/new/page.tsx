'use client'

import { useState, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { useParams, useRouter } from 'next/navigation'
import { useAuth } from "@/context/auth-provider"
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft } from 'lucide-react'
import { ImportTradesPageSkeleton } from '../../components/account-loading-skeletons'

const ImportTradesCard = dynamic(
  () => import('@/app/dashboard/components/import/import-trades-card'),
  { loading: () => <ImportTradesPageSkeleton />, ssr: false },
)

interface AccountData {
  id: string
  number: string
  name?: string
  displayName: string
  startingBalance: number
  status: string
  currentPhase?: {
    id: string
    phaseNumber: number
    status: string
    currentEquity: number
  }
}

export default function NewTradePage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [account, setAccount] = useState<AccountData | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const accountId = params.id as string

  const fetchAccount = useCallback(async () => {
    try {
      const response = await fetch(`/api/v1/prop-firm/accounts/${accountId}`)

      if (!response.ok) {
        throw new Error('Failed to fetch account details')
      }

      const data = await response.json()
      if (data.success) {
        setAccount(data.data.account)
      } else {
        throw new Error(data.error?.message || 'Failed to fetch account details')
      }
    } catch (error) {
      reportClientError(error, { operation: 'load-prop-firm-trade-entry-account', route: `/api/v1/prop-firm/accounts/${accountId}` })
      toast.error('Failed to fetch account details', {
        description: 'An error occurred while loading account details'
      })
    } finally {
      setIsLoading(false)
    }
  }, [accountId])

  useEffect(() => {
    if (user && accountId) {
      fetchAccount()
    }
  }, [user, accountId, fetchAccount])

  if (isLoading) {
    return <ImportTradesPageSkeleton />
  }

  if (!account) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <ArrowLeft className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">Account Not Found</h3>
          <p className="text-muted-foreground">The account you&apos;re looking for doesn&apos;t exist or you don&apos;t have access to it.</p>
          <Button onClick={() => router.back()} className="mt-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <div className="container mx-auto p-6 max-w-7xl">
        {            }
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}/trades`)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Trades
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Import Trades</h1>
              <p className="text-muted-foreground">
                {account.name || account.number} • {account.displayName}
              </p>
            </div>
          </div>
        </div>

        {                  }
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Account Information</CardTitle>
            <CardDescription>Overview of your prop firm account details</CardDescription>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-0">
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Account Number</Label>
              <p className="text-lg font-semibold">{account.number}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Status</Label>
              <p className="text-lg font-semibold capitalize">{account.status}</p>
            </div>
            <div>
              <Label className="text-sm font-medium text-muted-foreground">Current Phase</Label>
              <p className="text-lg font-semibold capitalize">
                Phase {account.currentPhase?.phaseNumber || "Not Available"}
              </p>
            </div>
          </CardContent>
        </Card>

        {                        }
        <ImportTradesCard accountId={accountId} />
      </div>
    </div>
  )
}
