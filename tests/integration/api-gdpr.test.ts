import { NextRequest } from 'next/server';
import { POST } from '@/app/api/v1/data/export/route';
import { DELETE } from '@/app/api/v1/user/delete/route';
import { getResolvedUserIdentitySafe } from '@/server/user-identity';
import { deleteUserData } from '@/server/user-data-deletion';
import { db } from '@/lib/db/client';
import { getSupabaseAdminClient } from '@/server/supabase-admin';
import * as observability from '@/lib/observability/report-error';
import { applyRateLimit } from '@/lib/rate-limiter';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/server/user-identity', () => ({
  getResolvedUserIdentitySafe: vi.fn(),
}));

vi.mock('@/server/user-data-deletion', () => ({
  deleteUserData: vi.fn(),
}));

vi.mock('@/lib/db/client', () => ({
  db: {
    select: vi.fn(() => {
      const query: any = {
        from: vi.fn(() => query),
        innerJoin: vi.fn(() => query),
        where: vi.fn(() => query),
      };
      return query;
    }),
    transaction: vi.fn(),
    query: {
      User: { findFirst: vi.fn() },
      Account: { findMany: vi.fn() },
      MasterAccount: { findMany: vi.fn() },
      TradingModel: { findMany: vi.fn() },
      TradeTag: { findMany: vi.fn() },
      DailyNote: { findMany: vi.fn() },
      WeeklyReview: { findMany: vi.fn() },
      Trade: { findMany: vi.fn() },
      BacktestTrade: { findMany: vi.fn() },
      DashboardTemplate: { findMany: vi.fn() },
      LiveAccountTransaction: { findMany: vi.fn() },
      BreachRecord: { findMany: vi.fn() },
      DailyAnchor: { findMany: vi.fn() },
      Payout: { findMany: vi.fn() },
      JournalTemplate: { findMany: vi.fn() },
      Notification: { findMany: vi.fn() },
      WeeklyAIReview: { findMany: vi.fn() },
      UserGoal: { findMany: vi.fn() },
      SharedReport: { findMany: vi.fn() },
      Feedback: { findMany: vi.fn() },
      UserGeoLog: { findMany: vi.fn() },
      PromoRedemption: { findMany: vi.fn() },
      PhaseAccount: { findMany: vi.fn() },
    }
  }
}));

vi.mock('@/server/supabase-admin', () => ({
  getSupabaseAdminClient: vi.fn(),
}));

vi.mock('@/lib/rate-limiter', () => ({
  applyRateLimit: vi.fn().mockResolvedValue(null),
  apiLimiter: {},
  accountDeletionLimiter: { points: 3, duration: 300, failClosed: true },
  sensitiveMutationLimiter: { points: 60, duration: 60, failClosed: true },
}));

describe('GDPR API Endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getResolvedUserIdentitySafe).mockReset();
    vi.mocked(deleteUserData).mockResolvedValue({
      internalUserId: 'user-123',
      authUserId: 'auth-123',
      storageOwnerIds: [],
    } as any);
  });

  describe('POST /api/v1/data/export', () => {
    it('should return 401 if unauthorized', async () => {
      vi.mocked(getResolvedUserIdentitySafe).mockResolvedValueOnce(null);
      
      const req = new NextRequest('http://localhost/api/v1/data/export', { method: 'POST' });
      
      const response = await POST(req as any);
      expect(response.status).toBe(401);
    });

    it('should trigger an export and return a zip stream', async () => {
      vi.mocked(getResolvedUserIdentitySafe).mockResolvedValueOnce({
        internalUserId: 'user-123',
        authUserId: 'auth-123',
      } as any);

      Object.values(db.query).forEach((mockQuery: any) => {
        if (mockQuery.findMany) vi.mocked(mockQuery.findMany).mockResolvedValue([]);
        if (mockQuery.findFirst) vi.mocked(mockQuery.findFirst).mockResolvedValue({ id: 'user-123' });
      });

      const req = new NextRequest('http://localhost/api/v1/data/export', { method: 'POST' });

      const response = await POST(req as any);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toBe('application/zip');
    });
  });

  describe('DELETE /api/v1/user/delete', () => {
    it('should return 401 if unauthorized', async () => {
      vi.mocked(getResolvedUserIdentitySafe).mockResolvedValueOnce(null);
      
      const req = new NextRequest('http://localhost/api/v1/user/delete', { method: 'DELETE' });
      
      const response = await DELETE(req as any);
      expect(response.status).toBe(401);
      expect(applyRateLimit).toHaveBeenCalledWith(
        req,
        { points: 3, duration: 300, failClosed: true },
      );
    });

    it('should execute transaction to delete data and delete auth user', async () => {
      vi.mocked(getResolvedUserIdentitySafe).mockResolvedValueOnce({
        internalUserId: 'user-123',
        authUserId: 'auth-123',
      } as any);

      const mockDeleteUser = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(getSupabaseAdminClient).mockReturnValue({
        auth: {
          admin: {
            deleteUser: mockDeleteUser,
          }
        }
      } as any);

      const req = new NextRequest('http://localhost/api/v1/user/delete', { method: 'DELETE' });

      const response = await DELETE(req as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(deleteUserData).toHaveBeenCalledWith(expect.objectContaining({
        internalUserId: 'user-123',
        authUserId: 'auth-123',
        mode: 'delete-account',
      }));
      expect(mockDeleteUser).toHaveBeenCalledWith('auth-123');
    });

    it('should return 502 if Supabase auth deletion fails', async () => {
      vi.mocked(getResolvedUserIdentitySafe).mockResolvedValueOnce({
        internalUserId: 'user-123',
        authUserId: 'auth-123',
      } as any);

      const authDeletionError = { message: 'Supabase error' };
      const mockDeleteUser = vi.fn().mockResolvedValue({ error: authDeletionError });
      const reportErrorSpy = vi.spyOn(observability, 'reportError');
      vi.mocked(getSupabaseAdminClient).mockReturnValue({
        auth: {
          admin: {
            deleteUser: mockDeleteUser,
          }
        }
      } as any);

      vi.mocked(db.transaction).mockResolvedValueOnce(true);

      const req = new NextRequest('http://localhost/api/v1/user/delete', { method: 'DELETE' });

      const response = await DELETE(req as any);
      const data = await response.json();

      expect(response.status).toBe(502);
      expect(data.error.message).toBe('Failed to fully delete account from auth provider');
      expect(data.error.code).toBe('AUTH_ACCOUNT_DELETE_FAILED');
      expect(reportErrorSpy).toHaveBeenCalledWith(
        authDeletionError,
        expect.objectContaining({
          operation: 'delete-auth-principal',
          requestId: expect.any(String),
        }),
      );
    });
  });
});
