'use server'
import logger from '@/lib/logger';

import { db } from '@/lib/db/client';
import * as schema from '@/lib/db/schema';
import { eq, inArray, and } from 'drizzle-orm';
import { getInternalUserIdSafe } from '@/server/user-identity';
import { ImageCompressor } from '@/lib/image-compression';
import { deletePublicStorageUrls } from '@/server/storage-admin';
import { parseTradeUpdate } from '@/lib/trades/update-schema';

import { invalidateTradesCache } from '@/lib/cache/invalidate-trade';

async function deleteTrade(tradeId: string) {
  try {
    const userId = await getInternalUserIdSafe()
    
    if (!userId) {
      return {
        success: false,
        error: 'User not authenticated'
      }
    }

    const trade = await db.query.Trade.findFirst({
      where: (table, { eq }) => and(eq(table.id, tradeId), eq(table.userId, userId)),
      columns: {
        accountId: true,
        imageOne: true,
        imageTwo: true,
        imageThree: true,
        imageFour: true,
        imageFive: true,
        imageSix: true,
        cardPreviewImage: true
      }
    })

    if (trade) {
      const imageUrls = [
        trade.imageOne,
        trade.imageTwo,
        trade.imageThree,
        trade.imageFour,
        trade.imageFive,
        trade.imageSix,
        trade.cardPreviewImage
      ].filter((url): url is string => !!url)

      if (imageUrls.length > 0) {
        try {
          await deletePublicStorageUrls(imageUrls)
        } catch (storageError) {
          logger.error({ event: 'system_error', error: storageError }, '[Delete Trade] Storage deletion failed:')
          // Continue with DB deletion even if storage fails
        }
      }
    }

    await db.delete(schema.Trade).where(and(eq(schema.Trade.id, tradeId), eq(schema.Trade.userId, userId)))
    await invalidateTradesCache(userId, trade?.accountId ?? null)

    return {
      success: true,
      message: 'Trade deleted successfully'
    }
  } catch (error) {
    return {
      success: false,
      error: 'Failed to delete trade'
    }
  }
}

async function updateTradeImage(
  tradeIds: string[],
  imageUrl: string | null,
  fieldName: 'cardPreviewImage' | 'imageOne' | 'imageTwo' | 'imageThree' | 'imageFour' | 'imageFive' | 'imageSix'
) {
  try {
    const userId = await getInternalUserIdSafe()
    
    if (!userId) {
      throw new Error('User not authenticated')
    }

  let processedImage = imageUrl

    await db.update(schema.Trade).set({ [fieldName]: processedImage }).where(and(inArray(schema.Trade.id, tradeIds), eq(schema.Trade.userId, userId)))
    await invalidateTradesCache(userId)

    return {
      success: true,
      message: 'Trade image updated successfully'
    }
  } catch (error) {
    throw error
  }
}

export async function updateTradeAction(tradeId: string, data: any) {
  try {
    const userId = await getInternalUserIdSafe()
    if (!userId) {
      throw new Error('User not authenticated')
    }

    const update = parseTradeUpdate(data)
    const updated = (await db.update(schema.Trade).set(update).where(and(eq(schema.Trade.id, tradeId), eq(schema.Trade.userId, userId))).returning())[0]
    await invalidateTradesCache(userId, updated?.accountId ?? null)

    return {
      success: true,
      data: JSON.parse(JSON.stringify(updated))
    }
  } catch (error) {
    logger.error({ event: 'system_error', error: error }, '[Update Trade Action] Error:')
    throw error
  }
}
