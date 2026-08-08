'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { HugeiconsIcon } from '@hugeicons/react'
import {
  AlertCircleIcon,
  Globe02Icon,
  Link01Icon,
  Mail01Icon,
  Message01Icon,
  Unlink01Icon,
} from '@hugeicons/core-free-icons'
import {
  linkDiscordAccount,
  linkGoogleAccount,
  unlinkIdentity,
  getUserIdentities
} from '@/server/auth/linked-identities'
import { toast } from "sonner"
import { reportClientError } from '@/lib/observability/report-error'
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
} from "@/components/ui/alert-dialog"


interface UserIdentity {
  id: string
  identity_id: string
  user_id: string
  identity_data?: { [key: string]: any }
  provider: string
  created_at?: string
  last_sign_in_at?: string
}

export function LinkedAccounts({ plain = false }: { plain?: boolean }) {
  const [identities, setIdentities] = useState<UserIdentity[]>([])
  const [loading, setLoading] = useState(true)
  const [linking, setLinking] = useState(false)

  useEffect(() => {
    loadIdentities()


    const urlParams = new URLSearchParams(window.location.search)
    const linked = urlParams.get('linked')
    if (linked) {
      toast.success("Account linked successfully")
      const newUrl = new URL(window.location.href)
      newUrl.searchParams.delete('linked')
      window.history.replaceState({}, '', newUrl.toString())
    }
  }, [])

  const loadIdentities = async () => {
    try {
      setLoading(true)
      const userIdentities = await getUserIdentities()

      const identitiesArray = (userIdentities?.identities || []) as UserIdentity[]
      setIdentities(identitiesArray)
    } catch (error) {
      setIdentities([])
      reportClientError(error, { operation: 'load-linked-identities', route: '/dashboard/settings' })
    } finally {
      setLoading(false)
    }
  }

  const handleLinkDiscord = async () => {
    try {
      setLinking(true)
      const result = await linkDiscordAccount()
      if (result.url) window.location.assign(result.url)
    } catch (error) {
      reportClientError(error, { operation: 'link-discord-account', route: '/dashboard/settings' })
      toast.error("Failed to link account")
      setLinking(false)
    }
  }

  const handleLinkGoogle = async () => {
    try {
      setLinking(true)
      const result = await linkGoogleAccount()
      if (result.url) window.location.assign(result.url)
    } catch (error) {
      reportClientError(error, { operation: 'link-google-account', route: '/dashboard/settings' })
      toast.error("Failed to link account")
      setLinking(false)
    }
  }

  const handleUnlink = async (identity: UserIdentity) => {
    try {
      await unlinkIdentity(identity)
      toast.success("Account unlinked successfully")
      await loadIdentities()
    } catch (error) {
      reportClientError(error, { operation: 'unlink-account', route: '/dashboard/settings' })
      toast.error(error instanceof Error ? error.message : "Failed to unlink account")
    }
  }

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'discord':
        return <HugeiconsIcon icon={Message01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      case 'google':
        return <HugeiconsIcon icon={Globe02Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      case 'email':
        return <HugeiconsIcon icon={Mail01Icon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
      default:
        return <HugeiconsIcon icon={AlertCircleIcon} className="h-4 w-4" strokeWidth={1.5} color="currentColor" />
    }
  }

  const getProviderName = (provider: string) => {
    switch (provider) {
      case 'discord':
        return "Discord"
      case 'google':
        return "Google"
      case 'email':
        return "Email"
      default:
        return provider
    }
  }

  const isDiscordLinked = identities.some(id => id.provider === 'discord')
  const isGoogleLinked = identities.some(id => id.provider === 'google')

  if (loading) {
    if (plain) {
      return (
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-semibold flex items-center gap-2">
              <HugeiconsIcon icon={Link01Icon} className="h-5 w-5" strokeWidth={1.5} color="currentColor" />
              Linked Accounts
            </h3>
            <p className="text-xs text-muted-foreground/85">
              Manage your connected social accounts for authentication
            </p>
          </div>
          <div className="text-center py-8 text-muted-foreground">
            Loading linked accounts...
          </div>
        </div>
      )
    }
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <HugeiconsIcon icon={Link01Icon} className="h-5 w-5" strokeWidth={1.5} color="currentColor" />
            Linked Accounts
          </CardTitle>
          <CardDescription>
            Manage your connected social accounts for authentication
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            Loading linked accounts...
          </div>
        </CardContent>
      </Card>
    )
  }

  const content = (
    <div className="space-y-6">
      {identities.length > 0 && (
        <div>
          <h4 className="text-sm font-medium mb-3">Primary Account</h4>
          <div className="space-y-3">
            {identities.map((identity, index) => (
              <div key={identity.id || index} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  {getProviderIcon(identity.provider)}
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">
                      {identity.identity_data?.email || getProviderName(identity.provider)}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getProviderName(identity.provider)}
                    </p>
                    {identity.last_sign_in_at && (
                      <p className="text-xs text-muted-foreground">
                        Last used: {new Date(identity.last_sign_in_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {identity.provider === 'email' && (
                    <Badge variant="secondary">Primary</Badge>
                  )}
                  {identity.provider !== 'email' && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="secondary" size="sm" className="w-full sm:w-auto">
                          <HugeiconsIcon icon={Unlink01Icon} className="h-4 w-4 sm:mr-2" strokeWidth={1.5} color="currentColor" />
                          <span className="hidden sm:inline">Unlink</span>
                          <span className="sm:hidden">Unlink Account</span>
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Unlink Account?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to unlink this account? You will need to use another linked account to sign in.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleUnlink(identity)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Unlink Account
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator />

      <div>
        <h4 className="text-sm font-medium mb-3">Link New Account</h4>
        <p className="text-sm text-muted-foreground mb-4">
          Connect additional accounts for easier sign-in
        </p>
        <div className="space-y-2">
          {!isDiscordLinked && (
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={handleLinkDiscord}
              disabled={linking}
            >
              <HugeiconsIcon icon={Message01Icon} className="mr-2 h-4 w-4" strokeWidth={1.5} color="currentColor" />
              Link Discord
            </Button>
          )}
          {!isGoogleLinked && (
            <Button
              variant="secondary"
              className="w-full justify-start"
              onClick={handleLinkGoogle}
              disabled={linking}
            >
              <HugeiconsIcon icon={Globe02Icon} className="mr-2 h-4 w-4" strokeWidth={1.5} color="currentColor" />
              Link Google
            </Button>
          )}
          {isDiscordLinked && isGoogleLinked && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No accounts available to link
            </p>
          )}
        </div>
      </div>
    </div>
  )

  if (plain) {
    return (
      <div className="space-y-6">
        <div>
          <h3 className="text-base font-semibold flex items-center gap-2">
            <HugeiconsIcon icon={Link01Icon} className="h-5 w-5" strokeWidth={1.5} color="currentColor" />
            Linked Accounts
          </h3>
          <p className="text-xs text-muted-foreground/85">
            Manage your connected social accounts for authentication
          </p>
        </div>
        {content}
      </div>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <HugeiconsIcon icon={Link01Icon} className="h-5 w-5" strokeWidth={1.5} color="currentColor" />
          Linked Accounts
        </CardTitle>
        <CardDescription>
          Manage your connected social accounts for authentication
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {content}
      </CardContent>
    </Card>
  )
} 
