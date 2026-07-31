import { pgTable, text, timestamp, uuid, jsonb } from 'drizzle-orm/pg-core'
import { User } from './users'
import { relations } from 'drizzle-orm'

export const AuditLog = pgTable('AuditLog', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: text('user_id')
    .notNull()
    .references(() => User.id, { onDelete: 'cascade' }),
  action: text('action').notNull(), // e.g. "CREATE_TRADE", "UPDATE_TRADE", "DELETE_TRADE"
  entityId: text('entity_id').notNull(), // e.g. the Trade UUID
  beforeData: jsonb('before_data'),
  afterData: jsonb('after_data'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

export const auditLogRelations = relations(AuditLog, ({ one }) => ({
  user: one(User, {
    fields: [AuditLog.userId],
    references: [User.id],
  }),
}))
