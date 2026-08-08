'use client'

import { HugeiconsIcon } from "@hugeicons/react"
import { Moon01Icon, Sun01Icon } from "@hugeicons/core-free-icons"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"

import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { UserAuthForm } from "@/components/user-auth-form"
import { useAuth } from "@/context/auth-provider"
import { useTheme } from "@/context/theme-provider"
import { usePublicSurfaceRouting } from "@/hooks/use-public-surface-routing"
import { getSafeRedirectPath } from "@/lib/security/redirects"

interface RootPageClientProps {
  nextUrl: string | null
}

export function RootPageClient({ nextUrl }: RootPageClientProps) {
  const { isAuthenticated, isLoading, ensureServerSession, forceClearAuth } = useAuth()
  const router = useRouter()
  const [isProcessingLogout, setIsProcessingLogout] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || isLoading || isProcessingLogout || !isAuthenticated) return
    let cancelled = false
    const destination = getSafeRedirectPath(nextUrl)

    const openWorkspace = async () => {
      const serverSessionReady = await ensureServerSession()
      if (cancelled) return

      if (!serverSessionReady) {
        forceClearAuth()
        return
      }

      router.replace(destination)
    }

    void openWorkspace()

    return () => {
      cancelled = true
    }
  }, [ensureServerSession, forceClearAuth, isAuthenticated, isClient, isLoading, isProcessingLogout, nextUrl, router])

  useEffect(() => {
    if (!isClient) return
    const hash = window.location.hash
    const params = new URLSearchParams(hash.slice(1))

    if (params.get('error')) {
      const errorDescription = params.get('error')
      toast.error("Authentication Error", {
        description: errorDescription?.replace(/\+/g, ' ') || "An error occurred during authentication",
      })
      router.replace('/')
    }
  }, [router, isClient])

  const { theme, toggleTheme } = useTheme()
  const { docsHref } = usePublicSurfaceRouting()

  if (isAuthenticated && !isLoading && !isProcessingLogout) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center bg-background">
        <div
          className="flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-muted-foreground">Opening your workspace...</p>
        </div>
      </main>
    )
  }

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col items-center justify-center bg-background selection:bg-primary/30">
      <div className="w-full max-w-[340px] relative z-10 px-6">
        <div className="flex flex-col items-center mb-10">
          <div className="mb-6 flex items-center gap-3">
            <Logo className="w-10 h-10" />
            <span className="text-xl font-bold tracking-tight text-foreground">
              JJI
            </span>
          </div>
        </div>

        <div>
          <UserAuthForm />
        </div>

        <div className="mt-10 flex flex-col items-center gap-4">
          <Button
            variant="tertiary"
            size="sm"
            className="text-muted-foreground hover:text-foreground transition-colors h-8 text-[11px] uppercase tracking-widest font-medium"
            onClick={() => toggleTheme()}
          >
            {theme === 'dark' ? (
              <HugeiconsIcon icon={Sun01Icon} className="h-3 w-3 mr-2" strokeWidth={2} color="currentColor" />
            ) : (
              <HugeiconsIcon icon={Moon01Icon} className="h-3 w-3 mr-2" strokeWidth={2} color="currentColor" />
            )}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
          <div className="flex items-center gap-6">
            <Link
              href={docsHref()}
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/80 uppercase tracking-[0.2em] font-medium transition-colors flex items-center"
            >
              Docs
            </Link>
            <button
              onClick={() => router.push('/privacy')}
              className="text-[10px] text-muted-foreground/40 hover:text-muted-foreground/80 uppercase tracking-[0.2em] font-medium transition-colors"
            >
              Privacy
            </button>
            <p className="text-[10px] text-muted-foreground/40 uppercase tracking-[0.2em] font-medium">
              &copy; {new Date().getFullYear()} JJI
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
