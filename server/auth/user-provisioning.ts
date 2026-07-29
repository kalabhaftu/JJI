'use server'

import { eq, sql } from 'drizzle-orm'

import { logActivity } from '@/lib/activity-logger'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { reportError } from '@/lib/observability/report-error'
import { extractUserSettingsWriteData } from '@/lib/user-settings'
import { signOut } from '@/server/auth/providers'
import { safeDbOperation } from '@/server/auth/database'

export interface SupabaseUser {
  id: string;
  email?: string | null;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: {
    full_name?: string;
    first_name?: string;
    last_name?: string;
    name?: string;
  };
}

function hasStoredName(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0
}

function buildGeneratedNames(user: SupabaseUser) {
  const metadata = user.user_metadata
  const fullName = metadata?.full_name?.trim() || metadata?.name?.trim() || null

  const firstName =
    metadata?.first_name?.trim() ||
    (fullName ? fullName.split(/\s+/)[0] : null) ||
    null

  const lastName =
    metadata?.last_name?.trim() ||
    (fullName && fullName.includes(' ')
      ? fullName.split(/\s+/).slice(1).join(' ').trim() || null
      : null)

  return { firstName, lastName }
}

function shouldHydrateNamesFromProvider(user: SupabaseUser) {
  const provider = user.app_metadata?.provider?.toLowerCase()
  const providers = (user.app_metadata?.providers || []).map(value => value.toLowerCase())
  return provider === 'google' || providers.includes('google')
}

export async function ensureUserInDatabase(user: SupabaseUser, locale?: string) {

  if (!user) {
    await signOut();
    throw new Error('User data is required for authentication.');
  }

  if (!user.id) {
    await signOut();
    throw new Error('User ID is required for authentication.');
  }

  try {
    const existingUserByAuthId = await safeDbOperation(
      () => db.query.User.findFirst({
        where: (table, { eq }) => eq(table.auth_user_id, user.id),
      }),
      null
    )

    const generatedNames = buildGeneratedNames(user)
    const shouldHydrateNames = shouldHydrateNamesFromProvider(user)

    if (existingUserByAuthId) {
      const needsEmailUpdate = existingUserByAuthId.email !== user.email
      const shouldFillFirstName =
        shouldHydrateNames &&
        !hasStoredName(existingUserByAuthId.firstName) &&
        hasStoredName(generatedNames.firstName)
      const shouldFillLastName =
        shouldHydrateNames &&
        !hasStoredName(existingUserByAuthId.lastName) &&
        hasStoredName(generatedNames.lastName)

      if (needsEmailUpdate || shouldFillFirstName || shouldFillLastName) {
        const updateData: any = {}

        if (needsEmailUpdate) {
          updateData.email = user.email || existingUserByAuthId.email
        }

        if (shouldFillFirstName) {
          updateData.firstName = generatedNames.firstName
        }

        if (shouldFillLastName) {
          updateData.lastName = generatedNames.lastName
        }

        try {
          const updatedUser = await safeDbOperation(
            () => db.transaction(async (tx) => {
              const updated = await tx.update(schema.User).set(updateData).where(eq(schema.User.auth_user_id, user.id)).returning().then(r => r[0]);

              if (!updated) throw new Error('Failed to update user');

              await tx.insert(schema.UserSettings).values({
                userId: updated.id,
                ...extractUserSettingsWriteData(updated as any),
                updatedAt: new Date()
              }).onConflictDoNothing();

              const accountCountRes = await tx.select({ count: sql`count(*)` }).from(schema.Account).where(eq(schema.Account.userId, updated.id));
              const accountCount = Number(accountCountRes[0]?.count || 0);
              
              const masterAccountCountRes = await tx.select({ count: sql`count(*)` }).from(schema.MasterAccount).where(eq(schema.MasterAccount.userId, updated.id));
              const masterAccountCount = Number(masterAccountCountRes[0]?.count || 0);
              
              if (accountCount === 0 && masterAccountCount === 0) {
                await tx.insert(schema.Account).values({
                  id: crypto.randomUUID(),
                  number: 'Default',
                  name: 'Main Trading Account',
                  startingBalance: 0,
                  isConfigured: false,
                  userId: updated.id,
                  updatedAt: new Date()
                });
              }

              return updated;
            }),
            existingUserByAuthId
          );
          return JSON.parse(JSON.stringify(updatedUser));
        } catch (updateError) {
          throw new Error('Failed to synchronize user profile.');
        }
      }
      
      const accounts = await db.query.Account.findFirst({ where: (table, { eq }) => eq(table.userId, existingUserByAuthId.id) });
      const masterAccounts = await db.query.MasterAccount.findFirst({ where: (table, { eq }) => eq(table.userId, existingUserByAuthId.id) });
      
      if (!accounts && !masterAccounts) {
        await db.insert(schema.Account).values({
            id: crypto.randomUUID(),
            number: 'Default',
            name: 'Main Trading Account',
            startingBalance: 0,
            isConfigured: false,
            userId: existingUserByAuthId.id,
            updatedAt: new Date()
        });
      }

      return JSON.parse(JSON.stringify(existingUserByAuthId));
    }

    if (user.email) {
      const existingUserByEmail = await safeDbOperation(
        () => db.query.User.findFirst({
          where: (table, { eq }) => eq(table.email, user.email!),
        }),
        null
      )

      if (existingUserByEmail && existingUserByEmail.auth_user_id !== user.id) {
        const relinkedUser = await safeDbOperation(
          () => db.transaction(async (tx) => {
              const updated = await tx.update(schema.User).set({
                auth_user_id: user.id,
                email: user.email || existingUserByEmail.email,
                firstName: hasStoredName(existingUserByEmail.firstName)
                  ? existingUserByEmail.firstName
                  : (shouldHydrateNames ? generatedNames.firstName : existingUserByEmail.firstName),
                lastName: hasStoredName(existingUserByEmail.lastName)
                  ? existingUserByEmail.lastName
                  : (shouldHydrateNames ? generatedNames.lastName : existingUserByEmail.lastName),
              }).where(eq(schema.User.email, user.email!)).returning().then(r => r[0]);

            if (!updated) throw new Error('Failed to update user');

            await tx.insert(schema.UserSettings).values({
                userId: updated.id,
                ...extractUserSettingsWriteData(updated as any),
                updatedAt: new Date()
              }).onConflictDoNothing();

              const accountCountRes = await tx.select({ count: sql`count(*)` }).from(schema.Account).where(eq(schema.Account.userId, updated.id));
              const accountCount = Number(accountCountRes[0]?.count || 0);
              
              const masterAccountCountRes = await tx.select({ count: sql`count(*)` }).from(schema.MasterAccount).where(eq(schema.MasterAccount.userId, updated.id));
            const masterAccountCount = Number(masterAccountCountRes[0]?.count || 0);
            
            if (accountCount === 0 && masterAccountCount === 0) {
              await tx.insert(schema.Account).values({
                  id: crypto.randomUUID(),
                  number: 'Default',
                  name: 'Main Trading Account',
                  startingBalance: 0,
                  isConfigured: false,
                  userId: updated.id,
                  updatedAt: new Date()
              });
            }

            return updated;
          }),
          null
        )

        if (!relinkedUser) {
          throw new Error('Failed to relink existing user account')
        }

        logActivity({
          userId: relinkedUser.id,
          action: 'USER_AUTH_RELINKED',
          entity: 'Auth',
          entityId: relinkedUser.id,
          metadata: {
            previousUserId: existingUserByEmail.id,
            previousAuthUserId: existingUserByEmail.auth_user_id,
            email: user.email,
          },
        })

        return JSON.parse(JSON.stringify(relinkedUser));
      }
    }

    try {
      const newUser = await safeDbOperation(
        () => db.transaction(async (tx) => {
          const created = await tx.insert(schema.User).values({
              auth_user_id: user.id,
              email: user.email || '',
              id: crypto.randomUUID(),
              role: 'user',
              firstName: generatedNames.firstName,
              lastName: generatedNames.lastName
          }).returning().then(r => r[0]);

          if (!created) {
            throw new Error('Failed to insert user record');
          }

          await tx.insert(schema.UserSettings).values({
              userId: created.id,
              ...extractUserSettingsWriteData(created as any),
              updatedAt: new Date()
          });

      await tx.insert(schema.Account).values({
              id: crypto.randomUUID(),
              number: 'Default',
              name: 'Main Trading Account',
              startingBalance: 0,
              isConfigured: false,
              userId: created.id,
              updatedAt: new Date()
          });

          return created;
        }),
        null
      );



      if (!newUser) {
        throw new Error('Failed to create user record in database');
      }

      logActivity({ userId: newUser.id, action: 'USER_SIGNUP', entity: 'Auth' })

      // Create default dashboard template for new user (non-blocking)
      try {
        const { ensureDefaultTemplate } = await import('../seed-default-template')
        await ensureDefaultTemplate()
      } catch (templateError) {
        reportError(templateError, {
          surface: 'server',
          operation: 'seed-default-dashboard-template',
          userId: newUser.id,
          extra: { fallbackUsed: true },
        })
      }

      return JSON.parse(JSON.stringify(newUser));
    } catch (createError) {
      if (createError instanceof Error &&
        createError.message.includes('Unique constraint failed')) {
        await signOut();
        throw new Error('Database integrity error: Duplicate user records found');
      }
      await signOut();
      throw new Error('Failed to create user account');
    }
  } catch (error) {
    // Re-throw NEXT_REDIRECT errors immediately (these are normal Next.js redirects)
    if (error instanceof Error && (
      error.message === 'NEXT_REDIRECT' ||
      ('digest' in error && typeof error.digest === 'string' && error.digest.startsWith('NEXT_REDIRECT'))
    )) {
      throw error;
    }

    // Handle database connection errors gracefully - DON'T sign out user
    if (error instanceof Error && (
      error.message.includes("Can't reach database server") ||
      error.message.includes('P1001') ||
      error.message.includes('Connection timeout') ||
      error.message.includes('ECONNREFUSED') ||
      error.message.includes('ENOTFOUND')
    )) {
      // Return without signing out - let the middleware handle the auth state
      return null;
    }

    // Handle Prisma validation errors (these require sign out)
    if (error instanceof Error) {
      if (error.message.includes('Argument `where` of type UserWhereUniqueInput needs')) {
        await signOut();
        throw new Error('Invalid user identification provided');
      }

      if (error.message.includes('Unique constraint failed')) {
        await signOut();
        throw new Error('Database integrity error: Duplicate user records found');
      }

      if (error.message.includes('Account conflict')) {
        // Error already handled above
        throw error;
      }
    }

    // For authentication-related errors, sign out the user
    if (error instanceof Error && (
      error.message.includes('User not authenticated') ||
      error.message.includes('Invalid authentication') ||
      error.message.includes('Token expired') ||
      error.message.includes('Invalid token')
    )) {
      await signOut();
      throw new Error('Authentication error occurred. Please log in again.');
    }

    // For other unexpected errors, don't sign out - just log and continue
    return null;
  }
}
