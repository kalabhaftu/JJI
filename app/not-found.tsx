'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from "@/components/ui/button"
import { Home as House, ArrowLeft } from "lucide-react"
import { useUserStore } from '@/store/user-store'

export default function NotFound() {
  const router = useRouter()
  const user = useUserStore(state => state.user)
  const isAuthenticated = !!user

  return (
    <main id="main-content" className="flex min-h-screen w-full flex-col items-center justify-center bg-background px-4 text-center">
      <div className="max-w-xl">
        <p className="text-sm font-semibold text-muted-foreground">Page not found</p>
        <h1 className="mt-3 select-none text-7xl font-bold leading-none text-foreground sm:text-9xl">
          404
        </h1>

        <p className="mx-auto mb-8 mt-5 max-w-md text-base text-muted-foreground">
          This address does not point to an active JJI page.
        </p>

        <div className="flex flex-col justify-center gap-3 sm:flex-row">
          <Button asChild size="lg" className="gap-2">
            <Link href={isAuthenticated ? "/dashboard" : "/"}>
              <House className="w-4 h-4" />
              {isAuthenticated ? "Back to Dashboard" : "Back home"}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="lg"
            onClick={() => router.back()}
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go back
          </Button>
        </div>
      </div>
    </main>
  )
}
