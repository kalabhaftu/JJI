'use server'

import { createClient, getWebsiteURL } from '@/server/auth/client'

export async function linkDiscordAccount() {
  const supabase = await createClient()
  const websiteURL = await getWebsiteURL()
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'discord',
    options: {
      redirectTo: `${websiteURL}api/auth/callback?action=link`,
    },
  })
  if (error) {
    throw new Error(error.message)
  }
  return data.url ? { url: data.url } : { url: null }
}

export async function linkGoogleAccount() {
  const supabase = await createClient()
  const websiteURL = await getWebsiteURL()
  const { data, error } = await supabase.auth.linkIdentity({
    provider: 'google',
    options: {
      redirectTo: `${websiteURL}api/auth/callback?action=link`,
    },
  })
  if (error) {
    throw new Error(error.message)
  }
  return data.url ? { url: data.url } : { url: null }
}

export async function unlinkIdentity(identity: any) {
  const supabase = await createClient()
  const { error } = await supabase.auth.unlinkIdentity(identity)
  if (error) {
    throw new Error(error.message)
  }
  return { success: true }
}

export async function getUserIdentities() {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user) {
    throw new Error('User not authenticated')
  }


  const { data: identities, error: identitiesError } = await supabase.auth.getUserIdentities()

  if (identitiesError) {
    throw new Error(identitiesError.message)
  }

  return identities
}
