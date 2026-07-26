'use server'

import logger from '@/lib/logger';

import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
// Groups removed - no longer used

import { createClient, getUserId, getUserIdSafe } from './auth'
import { Account } from '@/context/data-provider'
import { revalidateTag, unstable_cache } from 'next/cache'
import { USER_SETTINGS_SELECT, mergeUserSettings } from '@/lib/user-settings'


import { getAccountsAction } from './accounts'

import { type InferSelectModel } from 'drizzle-orm'
type User = InferSelectModel<typeof schema.User>

async function getUserData(): Promise<{
  userData: User | null;
  accounts: Account[];
  groups: never[]; // Groups removed - no longer used
}> {
  try {
    const userId = await getUserIdSafe()

    if (!userId) {
      return {
        userData: null,
        accounts: [],
        groups: [],
      }
    }

    const locale = 'en'

    // IMPORTANT: Removed unstable_cache wrapper to prevent "items over 2MB cannot be cached" errors
    // User data includes accounts which can exceed Next.js 2MB cache limit
    // Database queries are already fast with proper indexing
    try {
      const [userData, accounts, groups] = await Promise.all([
        (async () => {
          try {
            return await db.query.User.findFirst({
              where: (table, { eq }) => eq(table.auth_user_id, userId),
              columns: {
                id: true,
                email: true,
                auth_user_id: true,
                isFirstConnection: true,
                firstName: true,
                lastName: true,
              },
              with: {
                settings: true
              }
            })
          } catch (error) {
            return null
          }
        })(),
        (async () => {
          try {
            return await getAccountsAction()
          } catch (error) {
            return []
          }
        })(),
        Promise.resolve([])
      ])

      return JSON.parse(JSON.stringify({
        userData: userData ? mergeUserSettings(userData as any, (userData as any).settings) : null,
        accounts,
        groups,
      }))
    } catch (error) {
      return {
        userData: null,
        accounts: [],
        groups: [],
      }
    }
  } catch (error) {
    return {
      userData: null,
      accounts: [],
      groups: [],
    }
  }
}

export async function updateIsFirstConnectionAction(isFirstConnection: boolean) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const userId = user?.id

    if (!userId) {
      throw new Error('User not authenticated')
    }

    try {
      await db.update(schema.User).set({ isFirstConnection }).where(eq(schema.User.auth_user_id, userId));
    } catch (e) {
      logger.error({ event: 'system_error', error: e }, 'updateIsFirstConnectionAction failed:');
    }

    revalidateTag(`user-data-${userId}`)

    return { success: true }
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, 'updateIsFirstConnectionAction failed:')
    throw new Error('Failed to update onboarding status')
  }
}