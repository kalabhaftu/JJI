'use client'

import { Moon, Sun } from "lucide-react"
import { motion } from "framer-motion"
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
import { getDocsUrl } from "@/lib/urls"

interface RootPageClientProps {
  nextUrl: string | null
}

export function RootPageClient({ nextUrl }: RootPageClientProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [isProcessingLogout, setIsProcessingLogout] = useState(false)
  const [isClient, setIsClient] = useState(false)

  useEffect(() => {
    setIsClient(true)
  }, [])

  useEffect(() => {
    if (!isClient || isLoading || isProcessingLogout || !isAuthenticated) return
    const destination = nextUrl || '/dashboard'
    router.replace(`/app-launch?next=${encodeURIComponent(destination)}`)
  }, [isAuthenticated, isClient, isLoading, isProcessingLogout, nextUrl, router])

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

  if (isAuthenticated && !isLoading && !isProcessingLogout) {
    return (
      <main id="main-content" className="flex min-h-screen items-center justify-center bg-background">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
          role="status"
          aria-live="polite"
        >
          <Spinner className="h-8 w-8 text-primary" />
          <p className="text-muted-foreground animate-pulse">Restoring your session...</p>
        </motion.div>
      </main>
    )
  }

  return (
    <main id="main-content" className="relative flex min-h-screen flex-col items-center justify-center bg-background selection:bg-primary/30">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="w-full max-w-[340px] relative z-10 px-6"
      >
        <div className="flex flex-col items-center mb-10">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5 }}
            className="mb-6 flex items-center gap-3"
          >
            <Logo className="w-10 h-10" />
            <span className="text-xl font-bold tracking-tight text-foreground">
              JJI
            </span>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
        >
          <UserAuthForm />
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 1 }}
          className="mt-10 flex flex-col items-center gap-4"
        >
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground transition-colors h-8 text-[11px] uppercase tracking-widest font-medium"
            onClick={() => toggleTheme()}
          >
            {theme === 'dark' ? (
              <Sun className="h-3 w-3 mr-2" />
            ) : (
              <Moon className="h-3 w-3 mr-2" />
            )}
            {theme === 'dark' ? 'Light' : 'Dark'}
          </Button>
          <div className="flex items-center gap-6">
            <Link
              href={getDocsUrl()}
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
        </motion.div>
      </motion.div>
    </main>
  )
}
