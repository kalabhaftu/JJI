import { db } from '@/lib/db/client'
import { AuditLog } from '@/lib/db/schema'

type AuditSource = 'api' | 'server-action' | 'background-job' | 'cron' | 'system'

interface AuditInsertExecutor {
  insert: typeof db.insert
}

export interface AuditEventInput {
  userId: string | null
  action: string
  entityType: string
  entityId: string
  source: AuditSource
  requestId?: string | null | undefined
  ipAddress?: string | null | undefined
  beforeData?: unknown
  afterData?: unknown
}

const PRIVATE_AUDIT_KEY = /(?:authorization|cookie|token|secret|password|passcode|journal|note|content|payload|body|csv|screenshot|image|attachment|email|ipAddress)/i

function redactAuditValue(value: unknown, depth = 0): unknown {
  if (depth > 4) return '[Truncated]'
  if (Array.isArray(value)) {
    return value.slice(0, 50).map((entry) => redactAuditValue(entry, depth + 1))
  }
  if (!value || typeof value !== 'object') return value
  if (value instanceof Date) return value.toISOString()
  if (value instanceof Error) return { name: value.name }

  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !PRIVATE_AUDIT_KEY.test(key))
      .map(([key, nested]) => [key, redactAuditValue(nested, depth + 1)]),
  )
}

/**
 * Durable security/compliance audit record.
 *
 * Pass the active Drizzle transaction as `executor` when the material mutation
 * and its audit record must commit or roll back together.
 */
export async function recordAuditEvent(
  input: AuditEventInput,
  executor: AuditInsertExecutor = db,
): Promise<void> {
  await executor.insert(AuditLog).values({
    userId: input.userId,
    action: input.action,
    entityType: input.entityType,
    entityId: input.entityId,
    source: input.source,
    requestId: input.requestId ?? null,
    ipAddress: input.ipAddress ?? null,
    beforeData: input.beforeData === undefined
      ? null
      : redactAuditValue(input.beforeData),
    afterData: input.afterData === undefined
      ? null
      : redactAuditValue(input.afterData),
  })
}

export function buildBulkAuditSummary(input: {
  created?: number
  updated?: number
  skipped?: number
  failed?: number
  entityTypes?: string[]
}) {
  return {
    created: input.created ?? 0,
    updated: input.updated ?? 0,
    skipped: input.skipped ?? 0,
    failed: input.failed ?? 0,
    entityTypes: [...new Set(input.entityTypes ?? [])].sort(),
  }
}
