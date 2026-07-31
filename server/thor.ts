'use server'
import logger from '@/lib/logger';

import { revalidatePath } from 'next/cache'
import crypto from 'crypto'
import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq } from 'drizzle-orm'
import { getResolvedUserIdentity } from '@/server/user-identity'

export async function generateThorToken() {
  try {
    const { internalUserId } = await getResolvedUserIdentity()

    if (!internalUserId) {
      throw new Error('Unauthorized')
    }

    const token = crypto.randomBytes(32).toString('hex')
    
    await db.update(schema.User).set({
      thorToken: token
    }).where(eq(schema.User.id, internalUserId))

    revalidatePath('/dashboard')
    return { token }
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, 'Failed to generate Thor token:')
    return { error: 'Failed to generate token' }
  }
}

async function getThorToken() {
  try {
    const { internalUserId } = await getResolvedUserIdentity()

    if (!internalUserId) {
      throw new Error('Unauthorized')
    }

    const userData = await db.query.User.findFirst({
      where: (table, { eq }) => eq(table.id, internalUserId)
    })

    return { token: userData?.thorToken }
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, 'Failed to get Thor token:')
    return { error: 'Failed to get token' }
  }
}