'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
import { apiRequestData } from '@/lib/api/client'
import { queryKeys, queryKeyPrefixes } from '@/lib/query/query-keys'
import { useQueryScope, isScopeReady } from '@/lib/query/use-query-scope'
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Spinner } from "@/components/ui/spinner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { HugeiconsIcon } from '@hugeicons/react'
import {
  ArrowLeft01Icon,
  RefreshIcon,
  SaveIcon,
  ChevronLeftIcon,
  Setting06Icon,
  InformationCircleIcon,
  User02Icon,
  Mail01Icon,
  Calendar01Icon,
  ContactIcon,
  Shield01Icon,
  MapPinIcon,
  Globe02Icon,
  CreditCardIcon,
  DiamondIcon,
  Clock01Icon,
  UserMultipleIcon,
  TagsIcon,
  Alert02Icon,
  CircleCheckIcon,
  CircleXIcon,
  Target01Icon,
  Shield02Icon,
  Delete02Icon,
  Upload01Icon,
  Download01Icon
} from '@hugeicons/core-free-icons'
import { cn } from "@/lib/utils"
import { AccountStatus, PhaseType } from "@/types/prop-firm"
import { AccountSettingsPageSkeleton } from "../components/account-loading-skeletons"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface AccountData {
  id: string
  number: string
  name?: string
  propfirm: string
  status: AccountStatus
  currentEquity: number
  currentBalance: number
  startingBalance: number
  dailyDrawdownLimit: number
  maxDrawdownLimit: number
  profitTarget: number
  timezone: string
  dailyResetTime: string
  createdAt: string
  updatedAt: string
  notes?: string
  isArchived: boolean
}

interface PhaseData {
  id: string
  type: PhaseType
  startingBalance: number
  dailyDrawdownLimit: number
  maxDrawdownLimit: number
  profitTarget: number
  status: 'active' | 'passed' | 'failed'
  createdAt: string
  updatedAt: string
}

export default function AccountSettingsPage() {
  const params = useParams()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('general')
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    notes: '',
    isArchived: false
  })

  const accountId = params.id as string
  const scope = useQueryScope()
  const queryClient = useQueryClient()

  const accountQuery = useQuery({
    queryKey: queryKeys.propFirmAccount(scope, accountId),
    queryFn: ({ signal }) => apiRequestData<{ account: AccountData; phases: PhaseData[] }>(
      `/api/v1/prop-firm/accounts/${accountId}`,
      { signal, operation: 'load-prop-firm-account-settings' },
    ),
    enabled: isScopeReady(scope) && Boolean(accountId),
    staleTime: 30_000,
  })

  const account = accountQuery.data?.account ?? null
  const phases = accountQuery.data?.phases ?? []
  const isLoading = accountQuery.isLoading

  useEffect(() => {
    if (account) {
      setFormData({
        name: account.name || '',
        notes: account.notes || '',
        isArchived: account.isArchived || false
      })
    }
  }, [account])

  const saveMutation = useMutation({
    mutationFn: () => apiRequestData(`/api/v1/prop-firm/accounts/${accountId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
      retry: { mode: 'never' },
      operation: 'update-prop-firm-account-settings',
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.propFirmAccounts(scope) })
      toast.success('Account updated successfully', {
        description: 'Your account settings have been saved'
      })
    },
    onError: (error) => {
      reportClientError(error, { operation: 'update-prop-firm-account-settings', route: `/api/v1/prop-firm/accounts/${accountId}` })
      toast.error('Failed to update account', {
        description: 'An error occurred while updating account settings'
      })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => apiRequestData(`/api/v1/prop-firm/accounts/${accountId}`, {
      method: 'DELETE',
      retry: { mode: 'never' },
      operation: 'delete-prop-firm-account',
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.propFirmAccounts(scope) })
      await queryClient.invalidateQueries({ queryKey: queryKeyPrefixes.accounts(scope) })
      toast.success('Account deleted successfully', {
        description: 'The account has been permanently deleted'
      })
      router.push('/dashboard/prop-firm/accounts')
    },
    onError: (error) => {
      reportClientError(error, { operation: 'delete-prop-firm-account', route: `/api/v1/prop-firm/accounts/${accountId}` })
      toast.error('Failed to delete account', {
        description: 'An error occurred while deleting the account'
      })
    },
  })

  const getStatusColor = (status: AccountStatus) => {
    switch (status) {
      case 'active': return 'bg-foreground'
      case 'funded': return 'bg-long'
      case 'failed': return 'bg-short'
      case 'passed': return 'bg-chart-1'
      default: return 'bg-muted-foreground'
    }
  }

  const getPhaseStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-foreground'
      case 'passed': return 'bg-long'
      case 'failed': return 'bg-short'
      default: return 'bg-muted-foreground'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString()
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }))
  }

  const handleSave = () => {
    saveMutation.mutate()
  }

  const handleDeleteAccount = () => {
    setShowDeleteDialog(true)
  }

  const handleDeleteAccountConfirm = () => {
    setShowDeleteDialog(false)
    deleteMutation.mutate()
  }

  if (isLoading) {
    return <AccountSettingsPageSkeleton />
  }

  if (!account) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-12 w-12 text-muted-foreground mx-auto mb-4" strokeWidth={2} color="currentColor" />
            <h3 className="text-lg font-semibold mb-2">Account Not Found</h3>
            <p className="text-muted-foreground">The requested account could not be found.</p>
            <Button onClick={() => router.back()} className="mt-4">
              <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {            }
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button
            variant="tertiary"
            size="sm"
            onClick={() => router.push(`/dashboard/prop-firm/accounts/${accountId}`)}
          >
            <HugeiconsIcon icon={ArrowLeft01Icon} className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Account Settings</h1>
            <p className="text-muted-foreground">
              {account.name || account.number} • {account.propfirm}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => { void accountQuery.refetch() }}
            disabled={accountQuery.isFetching}
          >
            {accountQuery.isFetching ? <Spinner className="mr-2 h-4 w-4" /> : <HugeiconsIcon icon={RefreshIcon} className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
          <Button onClick={handleSave} size="sm" loading={saveMutation.isPending} loadingText="Saving changes">
            <HugeiconsIcon icon={SaveIcon} className="h-4 w-4 mr-2" />
            Save Changes
          </Button>
        </div>
      </div>

      {                  }
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="phases">Phases</TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>

        <TabsContent value="general">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <HugeiconsIcon icon={Setting06Icon} className="h-4 w-4" />
                  Account Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="accountNumber">Account Number</Label>
                  <Input
                    id="accountNumber"
                    value={account.number}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="accountName">Account Name</Label>
                  <Input
                    id="accountName"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter a custom name for this account"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="propFirm">Prop Firm</Label>
                  <Input
                    id="propFirm"
                    value={account.propfirm}
                    disabled
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="status">Status</Label>
                  <div className="flex items-center gap-2">
                    <Badge className={cn("text-white", getStatusColor(account.status))}>
                      {account.status}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => handleInputChange('notes', e.target.value)}
                    placeholder="Add any notes about this account"
                    rows={3}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="archived">Archive Account</Label>
                    <p className="text-sm text-muted-foreground">
                      Archived accounts are hidden from the main view
                    </p>
                  </div>
                  <Switch
                    id="archived"
                    checked={formData.isArchived}
                    onCheckedChange={(checked) => handleInputChange('isArchived', checked)}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Account Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Starting Balance</p>
                    <p className="font-medium">{formatCurrency(account.startingBalance)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Current Balance</p>
                    <p className="font-medium">{formatCurrency(account.currentBalance)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Current Equity</p>
                    <p className="font-medium">{formatCurrency(account.currentEquity)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Daily Drawdown Limit</p>
                    <p className="font-medium">{formatCurrency(account.dailyDrawdownLimit)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Max Drawdown Limit</p>
                    <p className="font-medium">{formatCurrency(account.maxDrawdownLimit)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Profit Target</p>
                    <p className="font-medium">{formatCurrency(account.profitTarget)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Timezone</p>
                    <p className="font-medium">{account.timezone}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Daily Reset Time</p>
                    <p className="font-medium">{account.dailyResetTime}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Created</p>
                    <p className="font-medium">{formatDateTime(account.createdAt)}</p>
                  </div>

                  <div>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                    <p className="font-medium">{formatDateTime(account.updatedAt)}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="phases">
          <Card>
            <CardHeader>
              <CardTitle>Account Phases</CardTitle>
            </CardHeader>
            <CardContent>
              {phases.length === 0 ? (
                <div className="text-center py-8">
                  <HugeiconsIcon icon={Target01Icon} className="h-12 w-12 text-muted-foreground mx-auto mb-4" strokeWidth={2} color="currentColor" />
                  <h3 className="text-lg font-semibold mb-2">No phases found</h3>
                  <p className="text-muted-foreground">This account doesn&apos;t have any phases yet.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {phases.map((phase) => (
                    <Card key={phase.id}>
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <h3 className="text-lg font-semibold">Phase {phase.type}</h3>
                              <Badge className={cn("text-white", getPhaseStatusColor(phase.status))}>
                                {phase.status}
                              </Badge>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <p className="text-muted-foreground">Starting Balance</p>
                                <p className="font-medium">{formatCurrency(phase.startingBalance)}</p>
                              </div>

                              <div>
                                <p className="text-muted-foreground">Daily Drawdown</p>
                                <p className="font-medium">{formatCurrency(phase.dailyDrawdownLimit)}</p>
                              </div>

                              <div>
                                <p className="text-muted-foreground">Max Drawdown</p>
                                <p className="font-medium">{formatCurrency(phase.maxDrawdownLimit)}</p>
                              </div>

                              <div>
                                <p className="text-muted-foreground">Profit Target</p>
                                <p className="font-medium">{formatCurrency(phase.profitTarget)}</p>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 text-sm mt-2">
                              <div>
                                <p className="text-muted-foreground">Created</p>
                                <p className="font-medium">{formatDateTime(phase.createdAt)}</p>
                              </div>

                              <div>
                                <p className="text-muted-foreground">Last Updated</p>
                                <p className="font-medium">{formatDateTime(phase.updatedAt)}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="advanced">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Danger Zone</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Delete Account</h3>
                  <p className="text-muted-foreground">
                    Permanently delete this account and all associated data. This action cannot be undone.
                  </p>
                </div>

                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDeleteAccount}
                >
                  <HugeiconsIcon icon={Delete02Icon} className="h-4 w-4 mr-2" />
                  Delete Account
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Export Data</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold">Download Account Data</h3>
                  <p className="text-muted-foreground">
                    Export all data associated with this account, including trades and phases.
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="secondary" size="sm">
                    <HugeiconsIcon icon={Download01Icon} className="h-4 w-4 mr-2" />
                    Export as CSV
                  </Button>

                  <Button variant="secondary" size="sm">
                    <HugeiconsIcon icon={Download01Icon} className="h-4 w-4 mr-2" />
                    Export as JSON
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

    {                                        }
    <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Account</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete this account? This will permanently remove all associated data. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDeleteAccountConfirm}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            Delete Account
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </div>
  )
}
