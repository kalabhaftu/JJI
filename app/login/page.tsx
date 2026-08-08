import { RootPageClient } from "../root-page-client"
import { createClient } from '@/server/auth/client'
import { getSafeRedirectPath } from '@/lib/security/redirects'
import { redirect } from 'next/navigation'

interface LoginPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextValue = resolvedSearchParams?.next
  const nextUrl = Array.isArray(nextValue) ? nextValue[0] : nextValue

  let authenticatedUser = false
  try {
    const supabase = await createClient()
    const { data: claims } = await supabase.auth.getClaims()
    authenticatedUser = typeof claims?.claims?.sub === 'string'
  } catch {
  }

  if (authenticatedUser) redirect(getSafeRedirectPath(nextUrl))

  return <RootPageClient nextUrl={nextUrl || null} />
}
