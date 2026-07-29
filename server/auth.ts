'use server'

export { createClient, getWebsiteURL } from '@/server/auth/client'
export { safeDbOperation } from '@/server/auth/database'
export { getUserId, getUserIdSafe } from '@/server/auth/identity'
export {
  getUserIdentities,
  linkDiscordAccount,
  linkGoogleAccount,
  unlinkIdentity,
} from '@/server/auth/linked-identities'
export { verifyOtp } from '@/server/auth/otp'
export {
  signInWithDiscord,
  signInWithEmail,
  signInWithGoogle,
  signOut,
} from '@/server/auth/providers'
export {
  ensureUserInDatabase,
  type SupabaseUser,
} from '@/server/auth/user-provisioning'
