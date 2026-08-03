"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"

import { Spinner } from "@/components/ui/spinner"
import { createClient } from "@/lib/supabase"

interface AppLaunchClientProps {
  nextPath: string
}

const restoreInFlight = new Map<string, Promise<Response>>()
let authCheckInFlight: Promise<boolean> | null = null

function checkServerSession() {
  if (authCheckInFlight) {
    return authCheckInFlight
  }

  authCheckInFlight = fetch("/api/auth/check", {
    cache: "no-store",
    headers: { "Cache-Control": "no-cache" },
  })
    .then(async (response) => {
      if (!response.ok) return false
      const data = await response.json().catch(() => null)
      return data?.authenticated === true
    })
    .finally(() => {
      authCheckInFlight = null
    })

  return authCheckInFlight
}

function buildRestoreSessionKey(accessToken: string, refreshToken: string) {
  return `${accessToken.slice(-12)}:${refreshToken.slice(-12)}`
}

async function restoreSession(accessToken: string, refreshToken: string) {
  const sessionKey = buildRestoreSessionKey(accessToken, refreshToken)
  const existing = restoreInFlight.get(sessionKey)
  if (existing) {
    return existing
  }

  const request = fetch("/api/auth/restore", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      accessToken,
      refreshToken,
    }),
  }).finally(() => {
    restoreInFlight.delete(sessionKey)
  })

  restoreInFlight.set(sessionKey, request)
  return request
}

export function AppLaunchClient({ nextPath }: AppLaunchClientProps) {
  const router = useRouter()
  const [status, setStatus] = useState("Checking your session...")

  useEffect(() => {
    let cancelled = false

    const clearStaleLocalSession = async () => {
      try {
        const supabase = createClient()
        await supabase.auth.signOut({ scope: "local" })
      } catch {

      }
    }

    const redirectToLogin = async () => {
      await clearStaleLocalSession()
      if (!cancelled) {
        router.replace(`/login?next=${encodeURIComponent(nextPath)}`)
      }
    }

    const bootstrap = async () => {
      try {
        const isServerAuthenticated = await checkServerSession()

        if (!cancelled && isServerAuthenticated) {
          setStatus("Opening dashboard...")
          router.replace(nextPath as Route)
          return
        }

        setStatus("Restoring secure session...")
        const supabase = createClient()
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error || !session?.access_token || !session.refresh_token) {
          await redirectToLogin()
          return
        }

        const restoreResponse = await restoreSession(
          session.access_token,
          session.refresh_token
        )

        if (!restoreResponse.ok) {
          await redirectToLogin()
          return
        }

        if (!cancelled) {
          setStatus("Opening dashboard...")
          router.replace(nextPath as Route)
        }
      } catch {
        await redirectToLogin()
      }
    }

    void bootstrap()

    return () => {
      cancelled = true
    }
  }, [nextPath, router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 text-foreground">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        <Spinner className="h-8 w-8 text-primary" />
        <div className="space-y-1">
          <p className="text-sm font-medium">Launching JJI</p>
          <p className="text-sm text-muted-foreground">{status}</p>
        </div>
      </div>
    </div>
  )
}
