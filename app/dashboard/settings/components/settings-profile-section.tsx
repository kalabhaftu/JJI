'use client'

import type { Dispatch, SetStateAction } from 'react'
import Link from 'next/link'
import { CreditCard, Pencil, User } from 'lucide-react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import type { SettingsProfileData, SettingsSubscriptionData } from './settings-types'

type SettingsUser = {
  email?: string | null
  created_at?: string
} | null

type SettingsProfileSectionProps = {
  user: SettingsUser
  avatarUrl?: string
  profileData: SettingsProfileData
  setProfileData: Dispatch<SetStateAction<SettingsProfileData>>
  isEditingProfile: boolean
  setIsEditingProfile: Dispatch<SetStateAction<boolean>>
  isLoadingProfile: boolean
  isUpdatingProfile: boolean
  onCancelEdit: () => void
  onSave: () => void
  subscriptionData: SettingsSubscriptionData | null
  isLoadingSubscription: boolean
  isCancelingSubscription: boolean
  onCancelSubscription: () => Promise<void>
}

export function SettingsProfileSection({
  user,
  avatarUrl,
  profileData,
  setProfileData,
  isEditingProfile,
  setIsEditingProfile,
  isLoadingProfile,
  isUpdatingProfile,
  onCancelEdit: handleCancelProfileEdit,
  onSave: handleProfileUpdate,
  subscriptionData,
  isLoadingSubscription,
  isCancelingSubscription,
  onCancelSubscription,
}: SettingsProfileSectionProps) {
  return (
      <div className="space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-heading-text">Profile & Plan</h2>
          <p className="text-xs text-muted-foreground/85">Manage your personal information and subscription plan</p>
        </div>

        {/* Profile Card */}
        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6" data-tour="settings-card-profile">
          <div className="flex items-start justify-between gap-4">
            <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
              <User className="h-4 w-4" />
              Personal Info
            </h3>
            <Button
              variant={isEditingProfile ? "secondary" : "outline"}
              size="sm"
              className="gap-2 h-8"
              onClick={() => setIsEditingProfile(true)}
              disabled={isLoadingProfile || isEditingProfile}
            >
              <Pencil className="h-3 w-3" />
              Edit
            </Button>
          </div>

          {/* User Info details */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted/20 border border-border/10">
            <Avatar className="h-12 w-12 shrink-0 border border-border/25">
              <AvatarImage key={avatarUrl ?? 'settings-avatar-fallback'} src={avatarUrl} referrerPolicy="no-referrer" />
              <AvatarFallback className="text-lg">
                {user?.email?.[0].toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm truncate text-heading-text">{user?.email}</p>
              <p className="text-xs text-muted-foreground">
                Member since {new Date(user?.created_at || '').toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <Badge variant="secondary" className="shrink-0 bg-muted text-muted-foreground border-border/25 text-xs font-normal">Active</Badge>
          </div>

          {isLoadingProfile ? (
            <div className="space-y-4">
              <div className="space-y-1.5"><Skeleton className="h-3 w-16" /><Skeleton className="h-9 w-full" /></div>
              <div className="space-y-1.5"><Skeleton className="h-3 w-16" /><Skeleton className="h-9 w-full" /></div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="firstName" className="text-xs text-muted-foreground">First Name</Label>
                <Input
                  id="firstName"
                  placeholder="Enter your first name"
                  value={profileData.firstName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, firstName: e.target.value }))}
                  disabled={isLoadingProfile || !isEditingProfile}
                  className="h-9 bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="lastName" className="text-xs text-muted-foreground">Last Name</Label>
                <Input
                  id="lastName"
                  placeholder="Enter your last name"
                  value={profileData.lastName}
                  onChange={(e) => setProfileData(prev => ({ ...prev, lastName: e.target.value }))}
                  disabled={isLoadingProfile || !isEditingProfile}
                  className="h-9 bg-background/50"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-muted-foreground">Email</Label>
            <Input id="email" type="email" value={user?.email || ''} disabled className="h-9 bg-background/25 border-border/20 text-muted-foreground" />
          </div>

          {isEditingProfile && (
            <div className="flex flex-col gap-2 sm:flex-row pt-2">
              <Button
                variant="outline"
                className="w-full sm:w-auto h-9 text-xs"
                onClick={handleCancelProfileEdit}
                disabled={isUpdatingProfile}
              >
                Cancel
              </Button>
              <Button
                onClick={handleProfileUpdate}
                loading={isUpdatingProfile || isLoadingProfile}
                loadingText={isLoadingProfile ? "Fetching..." : "Updating..."}
                className="w-full sm:w-auto h-9 text-xs"
              >
                Save Profile
              </Button>
            </div>
          )}
        </div>

        {/* Subscription Plan details */}
        <div className="rounded-xl border border-border/40 bg-card/45 p-6 space-y-6">
          <h3 className="text-sm font-semibold text-heading-text flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Subscription Plan
          </h3>

          {isLoadingSubscription ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-4 w-32" />
            </div>
          ) : subscriptionData ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/10">
                  <div>
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="text-sm font-semibold text-heading-text mt-0.5">
                      {subscriptionData.reason || subscriptionData.status}
                    </p>
                  </div>
                  <Badge variant={subscriptionData.hasAccess ? 'secondary' : 'destructive'} className="shrink-0">
                    {subscriptionData.hasAccess ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                {subscriptionData.currentPeriodEnd && (
                  <div className="flex items-center justify-between p-4 rounded-lg bg-muted/20 border border-border/10">
                    <div>
                      <p className="text-xs text-muted-foreground">Period Ends</p>
                      <p className="text-sm font-semibold text-heading-text mt-0.5">
                        {new Date(subscriptionData.currentPeriodEnd).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">
                      {(() => {
                        const days = Math.ceil((new Date(subscriptionData.currentPeriodEnd!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        return days > 0 ? `${days} day${days !== 1 ? 's' : ''} left` : 'Expired'
                      })()}
                    </span>
                  </div>
                )}
              </div>

              {subscriptionData.nextPaymentDue && (
                <div className="p-4 rounded-lg bg-muted/20 border border-border/10 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-muted-foreground">Next Payment Due</p>
                    <p className="text-sm font-semibold text-heading-text mt-0.5">
                      {new Date(subscriptionData.nextPaymentDue).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              )}

              {subscriptionData.provider === 'whop' && (
                <div className="p-4 rounded-lg bg-muted/20 border border-border/10 space-y-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Card billing</p>
                    <p className="text-sm font-semibold text-heading-text mt-0.5">
                      {subscriptionData.cancelAtPeriodEnd ? 'Cancels at period end' : 'Managed securely through Whop'}
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row">
                    {subscriptionData.manageUrl && (
                      <Button asChild variant="outline" size="sm" className="h-9 text-xs">
                        <a href={subscriptionData.manageUrl} target="_blank" rel="noopener noreferrer">
                          Payment methods & invoices
                        </a>
                      </Button>
                    )}
                    {!subscriptionData.cancelAtPeriodEnd && subscriptionData.hasAccess && (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9 text-xs" disabled={isCancelingSubscription}>
                            Cancel renewal
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel subscription renewal?</AlertDialogTitle>
                            <AlertDialogDescription>
                              You will keep JJI Pro until the current paid period ends. Future card renewals will stop. Payments already completed are not prorated.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep subscription</AlertDialogCancel>
                            <AlertDialogAction onClick={() => void onCancelSubscription()} disabled={isCancelingSubscription}>
                              Cancel renewal
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Billing changes and receipts are handled in Whop. See the <Link href="/terms" className="text-primary hover:underline">refund policy</Link>.
                  </p>
                </div>
              )}

              {!subscriptionData.hasAccess && (
                <Link href="/subscribe">
                  <Button size="sm" className="gap-2 w-full mt-2 h-9 text-xs">
                    <CreditCard className="h-3.5 w-3.5" />
                    Subscribe to Premium
                  </Button>
                </Link>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load subscription info</p>
          )}
        </div>
      </div>
  )
}
