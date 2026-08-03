import { describe, it, expect, beforeEach, vi } from 'vitest'
import * as NotificationService from '@/lib/services/notification-service'
import type { NotificationType, NotificationPriority } from '@/lib/db/schema/users'


const mockReturning = vi.fn()
const mockWhere = vi.fn(() => { const p = Promise.resolve({ count: 3 }); p.returning = mockReturning; return p; })
const mockSet = vi.fn(() => ({ where: mockWhere }))
const mockValues = vi.fn(() => ({ returning: mockReturning }))

vi.mock('@/lib/db/client', () => ({
    db: {
        query: {
            Notification: {
                findFirst: vi.fn()
            }
        },
        insert: vi.fn(() => ({ values: mockValues })),
        update: vi.fn(() => ({ set: mockSet })),
        updateMany: vi.fn(),
        count: vi.fn(),
        select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) }))
    }
}))


vi.mock('next/cache', () => ({
    revalidateTag: vi.fn()
}))

import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'

describe('NotificationService', () => {
    const userId = 'test-user-id'
    const phaseAccountId = 'test-phase-id'

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('createOrUpdateNotification', () => {
        it('should CREATE new notification when no invalidation key exists', async () => {
            mockReturning.mockResolvedValueOnce([{
                id: 'new-id',
                userId,
                type: 'SYSTEM',
                title: 'Test',
                message: 'Test message',
                data: null,
                isRead: false,
                actionRequired: false,
                invalidationKey: null,
                priority: 'MEDIUM',
                createdAt: new Date(),
                updatedAt: new Date()
            }])

            const result = await NotificationService.createOrUpdateNotification(userId, {
                type: 'SYSTEM',
                title: 'Test',
                message: 'Test message'
            })

            expect(result.success).toBe(true)
            expect(result.action).toBe('created')
            expect(db.insert).toHaveBeenCalledTimes(1)
        })

        it('should UPDATE existing unread notification with same invalidation key', async () => {
            const existingNotification = {
                id: 'existing-id',
                userId,
                type: 'RISK_DAILY_LOSS_80',
                title: 'Old title',
                message: 'Old message',
                data: { percentage: 80 },
                isRead: false,
                actionRequired: false,
                invalidationKey: 'risk_daily_loss_test-phase',
                priority: 'HIGH',
                createdAt: new Date(),
                updatedAt: new Date()
            }

            vi.mocked(db.query.Notification.findFirst).mockResolvedValue(existingNotification)
            mockReturning.mockResolvedValueOnce([{
                ...existingNotification,
                title: 'Updated title',
                message: 'Updated message',
                data: { percentage: 85 }
            }])

            const result = await NotificationService.createOrUpdateNotification(userId, {
                type: 'RISK_DAILY_LOSS_80',
                title: 'Updated title',
                message: 'Updated message',
                invalidationKey: 'risk_daily_loss_test-phase',
                data: { percentage: 85 }
            })

            expect(result.success).toBe(true)
            expect(result.action).toBe('updated')
            expect(db.query.Notification.findFirst).toHaveBeenCalled()
            expect(db.update).toHaveBeenCalledTimes(1)
            expect(db.insert).not.toHaveBeenCalled()
        })

        it('should CREATE new notification if existing is already read', async () => {

            vi.mocked(db.query.Notification.findFirst).mockResolvedValue(null)
            mockReturning.mockResolvedValueOnce([{
                id: 'new-id',
                userId,
                type: 'RISK_DAILY_LOSS_95',
                title: 'New alert',
                message: 'New message',
                data: null,
                isRead: false,
                actionRequired: true,
                invalidationKey: 'risk_daily_loss_test-phase',
                priority: 'CRITICAL',
                createdAt: new Date(),
                updatedAt: new Date()
            }])

            const result = await NotificationService.createOrUpdateNotification(userId, {
                type: 'RISK_DAILY_LOSS_95',
                title: 'New alert',
                message: 'New message',
                invalidationKey: 'risk_daily_loss_test-phase'
            })

            expect(result.success).toBe(true)
            expect(result.action).toBe('created')
            expect(db.insert).toHaveBeenCalledTimes(1)
        })
    })

    describe('createRiskAlert', () => {
        const metadata = {
            accountName: 'Test Account',
            currentBalance: 9500,
            limit: 1000,
            used: 800
        }

        it('should create HIGH priority alert at 80% daily loss', async () => {
            vi.mocked(db.query.Notification.findFirst).mockResolvedValue(null)
            mockReturning.mockResolvedValueOnce([{
                id: 'alert-id',
                userId,
                type: 'RISK_DAILY_LOSS_80',
                title: 'WARNING: Daily Loss Limit at 80%',
                message: expect.any(String),
                data: expect.any(Object),
                isRead: false,
                actionRequired: false,
                invalidationKey: `risk_daily_loss_${phaseAccountId}`,
                priority: 'HIGH',
                createdAt: new Date(),
                updatedAt: new Date()
            }])

            const result = await NotificationService.createRiskAlert(
                userId,
                phaseAccountId,
                'daily_loss',
                80.5,
                metadata
            )

            expect(result.success).toBe(true)
            const createCallData = mockValues.mock.calls[0][0]
            expect(createCallData.type).toBe('RISK_DAILY_LOSS_80')
            expect(createCallData.priority).toBe('HIGH')
            expect(createCallData.actionRequired).toBe(false)
        })

        it('should create CRITICAL priority alert at 95% daily loss', async () => {
            vi.mocked(db.query.Notification.findFirst).mockResolvedValue(null)
            mockReturning.mockResolvedValueOnce([{
                id: 'alert-id',
                userId,
                type: 'RISK_DAILY_LOSS_95',
                title: 'CRITICAL: Daily Loss Limit at 95%',
                message: expect.any(String),
                data: expect.any(Object),
                isRead: false,
                actionRequired: true,
                invalidationKey: `risk_daily_loss_${phaseAccountId}`,
                priority: 'CRITICAL',
                createdAt: new Date(),
                updatedAt: new Date()
            }])

            const result = await NotificationService.createRiskAlert(
                userId,
                phaseAccountId,
                'daily_loss',
                96.2,
                metadata
            )

            expect(result.success).toBe(true)
            const createCallData = mockValues.mock.calls[0][0]
            expect(createCallData.type).toBe('RISK_DAILY_LOSS_95')
            expect(createCallData.priority).toBe('CRITICAL')
            expect(createCallData.actionRequired).toBe(true)
        })

        it('should update same notification when percentage increases', async () => {

            vi.mocked(db.query.Notification.findFirst).mockResolvedValue({
                id: 'existing-alert',
                userId,
                type: 'RISK_DAILY_LOSS_80',
                title: 'WARNING: Daily Loss Limit at 80%',
                message: 'Old message',
                data: { percentage: 80.5 },
                isRead: false,
                actionRequired: false,
                invalidationKey: `risk_daily_loss_${phaseAccountId}`,
                priority: 'HIGH',
                createdAt: new Date(),
                updatedAt: new Date()
            })

            mockReturning.mockResolvedValueOnce([{
                id: 'existing-alert',
                userId,
                type: 'RISK_DAILY_LOSS_80',
                title: 'WARNING: Daily Loss Limit at 80%',
                message: 'Updated message',
                data: { percentage: 85.2 },
                isRead: false,
                actionRequired: false,
                invalidationKey: `risk_daily_loss_${phaseAccountId}`,
                priority: 'HIGH',
                createdAt: new Date(),
                updatedAt: new Date()
            }])

            const result = await NotificationService.createRiskAlert(
                userId,
                phaseAccountId,
                'daily_loss',
                85.2,
                metadata
            )

            expect(result.success).toBe(true)
            expect(result.action).toBe('updated')
            expect(db.update).toHaveBeenCalledTimes(1)
            expect(db.insert).not.toHaveBeenCalled()
        })
    })

    describe('createImportNotification', () => {
        const importId = 'import-123'

        it('should create "processing" notification', async () => {
            vi.mocked(db.query.Notification.findFirst).mockResolvedValue(null)
            mockReturning.mockResolvedValueOnce([{
                id: 'import-notif',
                userId,
                type: 'IMPORT_PROCESSING',
                title: '⏳ Import in Progress',
                message: expect.any(String),
                data: { importId, status: 'processing', startedAt: expect.any(String) },
                isRead: false,
                actionRequired: false,
                invalidationKey: `import_${importId}`,
                priority: 'MEDIUM',
                createdAt: new Date(),
                updatedAt: new Date()
            }])

            const result = await NotificationService.createImportNotification(
                userId,
                importId,
                'processing'
            )

            expect(result.success).toBe(true)
            expect(result.action).toBe('created')
        })

        it('should update to "complete" notification with summary', async () => {
            vi.mocked(db.query.Notification.findFirst).mockResolvedValue({
                id: 'import-notif',
                userId,
                type: 'IMPORT_PROCESSING',
                title: '⏳ Import in Progress',
                message: 'Old message',
                data: { importId, status: 'processing' },
                isRead: false,
                actionRequired: false,
                invalidationKey: `import_${importId}`,
                priority: 'MEDIUM',
                createdAt: new Date(),
                updatedAt: new Date()
            })

            mockReturning.mockResolvedValueOnce([{
                id: 'import-notif',
                userId,
                type: 'IMPORT_COMPLETE',
                title: 'Import Complete',
                message: 'Successfully imported 145 trades in 3.2s. ',
                data: { importId, status: 'complete', summary: { tradesImported: 145, errors: 0, duration: 3.2 } },
                isRead: false,
                actionRequired: false,
                invalidationKey: `import_${importId}`,
                priority: 'MEDIUM',
                createdAt: new Date(),
                updatedAt: new Date()
            }])

            const result = await NotificationService.createImportNotification(
                userId,
                importId,
                'complete',
                {
                    tradesImported: 145,
                    errors: 0,
                    warnings: 2,
                    duration: 3.2
                }
            )

            expect(result.success).toBe(true)
            expect(result.action).toBe('updated')
        })

        it('should mark as HIGH priority if errors exist', async () => {
            vi.mocked(db.query.Notification.findFirst).mockResolvedValue(null)
            mockReturning.mockResolvedValueOnce([{
                id: 'import-notif',
                userId,
                type: 'IMPORT_COMPLETE',
                title: 'Import Complete (5 errors)',
                message: expect.any(String),
                data: expect.any(Object),
                isRead: false,
                actionRequired: true,
                invalidationKey: `import_${importId}`,
                priority: 'HIGH',
                createdAt: new Date(),
                updatedAt: new Date()
            }])

            const result = await NotificationService.createImportNotification(
                userId,
                importId,
                'complete',
                {
                    tradesImported: 140,
                    errors: 5,
                    duration: 4.1
                }
            )

            expect(result.success).toBe(true)
            const createCallData = mockValues.mock.calls[0][0]
            expect(createCallData.priority).toBe('HIGH')
            expect(createCallData.actionRequired).toBe(true)
        })
    })

    describe('dismissNotificationsByType', () => {
        it('should mark all notifications of type as read', async () => {
            mockWhere.mockResolvedValueOnce({ count: 3 })

            const result = await NotificationService.dismissNotificationsByType(
                userId,
                'RISK_ALERT'
            )

            expect(result.success).toBe(true)
            expect(db.update).toHaveBeenCalledWith(schema.Notification)
            expect(mockSet).toHaveBeenCalledWith({ isRead: true })
            expect(mockWhere).toHaveBeenCalledTimes(1)
        })
    })

    describe('getNotificationStats', () => {
        it('should return notification statistics', async () => {
            const mockWhereSelect = vi.fn()
            vi.mocked(db.select).mockReturnValue({ from: vi.fn(() => ({ where: mockWhereSelect })) } as any)
            mockWhereSelect
                .mockResolvedValueOnce([{ value: 25 }])
                .mockResolvedValueOnce([{ value: 8 }])
                .mockResolvedValueOnce([{ value: 2 }])

            const result = await NotificationService.getNotificationStats(userId)

            expect(result.success).toBe(true)
            expect(result.data).toEqual({
                total: 25,
                unread: 8,
                critical: 2
            })
        })
    })
})