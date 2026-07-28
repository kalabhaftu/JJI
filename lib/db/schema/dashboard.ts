import { relations } from 'drizzle-orm';
import { pgTable, uuid, text, integer, boolean, timestamp, jsonb, doublePrecision, json } from 'drizzle-orm/pg-core';
import { AdminFeatureFlag, AdminSharingPolicy, User, UserSettings, ImportJob, Notification, Feedback, UserGeoLog, SharedReport, Subscription, Synchronization } from './users';

export const DashboardTemplate = pgTable('DashboardTemplate', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: text('userId').notNull().references(() => User.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  isDefault: boolean('isDefault').default(false),
  isActive: boolean('isActive').default(false),
  layout: jsonb('layout').default('[]'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type DashboardTemplateType = typeof DashboardTemplate.$inferSelect;
export type NewDashboardTemplate = typeof DashboardTemplate.$inferInsert;

export const AdminWidgetSetting = pgTable('AdminWidgetSetting', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  widgetType: text('widgetType').notNull().unique(),
  label: text('label'),
  description: text('description'),
  visible: boolean('visible').default(true),
  recommended: boolean('recommended').default(false),
  deprecated: boolean('deprecated').default(false),
  status: text('status').default('stable'),
  premiumOnly: boolean('premiumOnly').default(false),
  roleGate: text('roleGate'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type AdminWidgetSettingType = typeof AdminWidgetSetting.$inferSelect;
export type NewAdminWidgetSetting = typeof AdminWidgetSetting.$inferInsert;

export const AdminDashboardPreset = pgTable('AdminDashboardPreset', {
  id: text('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  name: text('name').notNull().unique(),
  segment: text('segment').default('all'),
  description: text('description'),
  layout: jsonb('layout').default('[]'),
  active: boolean('active').default(true),
  recommended: boolean('recommended').default(false),
  createdAt: timestamp('createdAt', { withTimezone: true, mode: 'date' }).defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true, mode: 'date' }).defaultNow().notNull().$onUpdateFn(() => new Date()),
});

export type AdminDashboardPresetType = typeof AdminDashboardPreset.$inferSelect;
export type NewAdminDashboardPreset = typeof AdminDashboardPreset.$inferInsert;

export const DashboardTemplateRelations = relations(DashboardTemplate, ({ one, many }) => ({
  User: one(User, {
    fields: [DashboardTemplate.userId],
    references: [User.id]
  }),
}));
