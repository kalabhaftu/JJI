import HomePage from "./home-page-client"
import { redirect } from "next/navigation"

interface RootPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>
}

function firstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value
}

export default async function RootPage({ searchParams }: RootPageProps) {
  const params = (await searchParams) || {}
  const code = firstParam(params.code)
  const errorCode = firstParam(params.error_code)

  if (code || errorCode) {
    const callbackParams = new URLSearchParams()
    const next = firstParam(params.next)
    const action = firstParam(params.action)

    if (code) callbackParams.set('code', code)
    if (errorCode) callbackParams.set('error_code', errorCode)
    if (next) callbackParams.set('next', next)
    if (action) callbackParams.set('action', action)

    redirect(`/api/auth/callback?${callbackParams.toString()}`)
  }

  return <HomePage />
}
