import { AppLaunchClient } from "./app-launch-client"
import { getSafeRedirectPath } from "@/lib/security/redirects"

interface AppLaunchPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function AppLaunchPage({ searchParams }: AppLaunchPageProps) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined
  const nextValue = resolvedSearchParams?.next
  const nextPath = Array.isArray(nextValue) ? nextValue[0] : nextValue

  return <AppLaunchClient nextPath={getSafeRedirectPath(nextPath)} />
}
