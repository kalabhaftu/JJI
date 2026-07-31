'use server'
import { db } from "@/lib/db/client"
import * as schema from '@/lib/db/schema'
import { getResolvedUserIdentity } from "@/server/user-identity"
import { and, eq } from 'drizzle-orm'

import { encrypt, decrypt } from '@/lib/security/encryption';
import { DIRECT_SYNC_STATUS, directSyncUnderDevelopmentMessage } from '@/lib/integrations/direct-sync-status'

export async function getRithmicSynchronizations() {
  const { internalUserId } = await getResolvedUserIdentity()
  const synchronizations = await db.query.Synchronization.findMany({
    where: (table, { eq, and }) => and(eq(table.userId, internalUserId), eq(table.service, "rithmic")),
  })
  
  return synchronizations.map(sync => ({
    ...sync,
    token: decrypt(sync.token) || sync.token
  }));
}

export async function setRithmicSynchronization(synchronization: any) {
  if (DIRECT_SYNC_STATUS.isPaused) {
    void synchronization
    throw new Error(directSyncUnderDevelopmentMessage('Rithmic'))
  }

  const { internalUserId } = await getResolvedUserIdentity()
  const token = synchronization.token ? encrypt(synchronization.token) : synchronization.token;
  
  await db.insert(schema.Synchronization).values({
    ...synchronization,
    token,
    service: synchronization.service || 'rithmic',
    accountId: synchronization.accountId || '',
    lastSyncedAt: synchronization.lastSyncedAt || new Date(),
    userId: internalUserId,
    includedFeeTypes: undefined,
  }).onConflictDoUpdate({
    target: [schema.Synchronization.userId, schema.Synchronization.service, schema.Synchronization.accountId],
    set: {
      ...synchronization,
      token,
      userId: internalUserId,
      includedFeeTypes: undefined,
    },
  })
}

export async function removeRithmicSynchronization(accountId: string) {
  const { internalUserId } = await getResolvedUserIdentity()

  await db.delete(schema.Synchronization).where(
    and(eq(schema.Synchronization.userId, internalUserId), eq(schema.Synchronization.service, "rithmic"), eq(schema.Synchronization.accountId, accountId))
  )
}
