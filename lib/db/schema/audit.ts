import { index, pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core'
import { User } from './users'
import { relations, sql } from 'drizzle-orm'

export const AuditLog = pgTable('AuditLog', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .references(() => User.id, { onDelete: 'set null' }),
  action: text('action').notNull(), // e.g. "CREATE_TRADE", "UPDATE_TRADE", "DELETE_TRADE"
  entityId: text('entity_id').notNull(), // e.g. the Trade UUID
  entityType: text('entity_type'),
  source: text('source'),
  requestId: text('request_id'),
  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => [
  index('AuditLog_request_id_idx')
    .on(table.requestId)
    .where(sql`${table.requestId} is not null`),
])

export const auditLogRelations = relations(AuditLog, ({ one }) => ({
  user: one(User, {
    fields: [AuditLog.userId],
    references: [User.id],
  }),
}))
