import { db } from '@/lib/db/client'
import { ActivityLog } from '@/lib/db/schema'
import { getClientIp as resolveClientIp } from '@/lib/security/client-ip'

interface LogActivityParams {
  userId: string
  action: string
  entity: string
  entityId?: string | null
  metadata?: Record<string, any> | null
  ipAddress?: string | null
  requestId?: string | null
}


export function logActivity(params: LogActivityParams): void {
  db.insert(ActivityLog)
    .values({
      userId: params.userId,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId ?? null,
      metadata: params.metadata ?? undefined,
      ipAddress: params.ipAddress ?? null,
      requestId: params.requestId ?? null,
    })
    .execute()
    .catch(() => {

    })
}


export function getClientIp(request: Request): string | null {
  const address = resolveClientIp(request.headers)
  return address === 'unknown' ? null : address
}

