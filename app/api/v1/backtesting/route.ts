import { NextRequest, NextResponse } from 'next/server'
import { reportApiHandlerError, withCanonicalApiResponse } from '@/lib/api/canonical-handler'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { applyRateLimit, apiLimiter } from '@/lib/rate-limiter'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { eq, and } from 'drizzle-orm'
import { deletePublicStorageUrls } from '@/server/storage-admin'

// GET - Fetch all backtests for user
async function getBacktests(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ 
        backtests: [],
        message: 'No authenticated user' 
      }, { status: 200 })
    }

    const internalUserId = identity.internalUserId

    // Fetch all backtests for user
    const backtests = await db.query.BacktestTrade.findMany({
      where: (table, { eq }) => eq(table.userId, internalUserId),
      orderBy: (table, { desc }) => [desc(table.dateExecuted)]
    })

    return NextResponse.json({ backtests }, { status: 200 })
  } catch (error) {
    reportApiHandlerError(request, error, 'list-backtests')
    return NextResponse.json(
      { error: 'Failed to fetch backtests' },
      { status: 500 }
    )
  }
}

// POST - Create new backtest
async function createBacktest(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const internalUserId = identity.internalUserId

    const body = await request.json()
    const {
      pair,
      direction,
      outcome,
      session,
      model,
      customModel,
      riskRewardRatio,
      riskPoints,
      rewardPoints,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      pnl,
      images,
      cardPreviewImage,
      notes,
      tags,
      dateExecuted,
      backtestDate
    } = body

    // Validate required fields
    if (!pair || !direction || !outcome || !session || !model) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Create backtest
    const backtest = (await db.insert(schema.BacktestTrade).values({
      id: crypto.randomUUID(),
      updatedAt: new Date(),
      userId: internalUserId,
      pair,
      direction,
      outcome,
      session,
      model,
      customModel: customModel || null,
      riskRewardRatio: parseFloat(riskRewardRatio) || 0,
      riskPoints: parseFloat(riskPoints) || 0,
      rewardPoints: parseFloat(rewardPoints) || 0,
      entryPrice: parseFloat(entryPrice),
      stopLoss: parseFloat(stopLoss),
      takeProfit: parseFloat(takeProfit),
      exitPrice: parseFloat(exitPrice),
      pnl: parseFloat(pnl),
      imageOne: images?.[0] || null,
      imageTwo: images?.[1] || null,
      imageThree: images?.[2] || null,
      imageFour: images?.[3] || null,
      imageFive: images?.[4] || null,
      imageSix: images?.[5] || null,
      cardPreviewImage: cardPreviewImage || null,
      notes: notes || null,
      tags: tags || [],
      dateExecuted: dateExecuted ? new Date(dateExecuted) : new Date(),
      backtestDate: backtestDate ? new Date(backtestDate) : null,
    }).returning())[0]

    return NextResponse.json({ backtest }, { status: 201 })
  } catch (error) {
    reportApiHandlerError(request, error, 'create-backtest')
    return NextResponse.json(
      { error: 'Failed to create backtest' },
      { status: 500 }
    )
  }
}

// PUT - Update backtest
async function updateBacktest(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const internalUserId = identity.internalUserId

    const body = await request.json()
    const { id, notes, tags, model, customModel, images, cardPreviewImage } = body

    if (!id) {
      return NextResponse.json({ error: 'Backtest ID required' }, { status: 400 })
    }

    // Verify ownership
    const existingBacktest = await db.query.BacktestTrade.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId))
    })

    if (!existingBacktest) {
      return NextResponse.json(
        { error: 'Backtest not found or unauthorized' },
        { status: 404 }
      )
    }

    // Update backtest
    const updateData: any = {
      updatedAt: new Date()
    }

    if (notes !== undefined) updateData.notes = notes || null
    if (tags !== undefined) updateData.tags = tags || []
    if (model !== undefined) updateData.model = model
    if (customModel !== undefined) updateData.customModel = customModel || null
    if (cardPreviewImage !== undefined) updateData.cardPreviewImage = cardPreviewImage || null

    if (images !== undefined) {
      updateData.imageOne = images[0] || null
      updateData.imageTwo = images[1] || null
      updateData.imageThree = images[2] || null
      updateData.imageFour = images[3] || null
      updateData.imageFive = images[4] || null
      updateData.imageSix = images[5] || null
    }

    const backtest = (await db.update(schema.BacktestTrade).set(updateData).where(and(
      eq(schema.BacktestTrade.id, id),
      eq(schema.BacktestTrade.userId, internalUserId),
    )).returning())[0]

    return NextResponse.json({ backtest }, { status: 200 })
  } catch (error) {
    reportApiHandlerError(request, error, 'update-backtest')
    return NextResponse.json(
      { error: 'Failed to update backtest' },
      { status: 500 }
    )
  }
}

// DELETE - Delete backtest
async function deleteBacktest(request: NextRequest) {
  const rateLimitRes = await applyRateLimit(request, apiLimiter)
  if (rateLimitRes) return rateLimitRes

  try {
    const identity = await getResolvedUserIdentitySafe()
    if (!identity) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const internalUserId = identity.internalUserId

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'Backtest ID required' }, { status: 400 })
    }

    // 1. Fetch backtest to get image URLs
    const backtestTrade = await db.query.BacktestTrade.findFirst({
      where: (table, { eq, and }) => and(eq(table.id, id), eq(table.userId, internalUserId)),
      columns: {
        imageOne: true,
        imageTwo: true,
        imageThree: true,
        imageFour: true,
        imageFive: true,
        imageSix: true,
        cardPreviewImage: true
      }
    })

    if (!backtestTrade) {
      return NextResponse.json(
        { error: 'Backtest not found or unauthorized' },
        { status: 404 }
      )
    }

    // 2. Collect image URLs
    const imageUrls = [
      backtestTrade.imageOne,
      backtestTrade.imageTwo,
      backtestTrade.imageThree,
      backtestTrade.imageFour,
      backtestTrade.imageFive,
      backtestTrade.imageSix,
      backtestTrade.cardPreviewImage
    ].filter((url): url is string => !!url)

    // 3. Delete from storage
    if (imageUrls.length > 0) {
      try {
        await deletePublicStorageUrls(imageUrls)
      } catch (error) {
        reportApiHandlerError(request, error, 'delete-backtest-storage')
      }
    }

    // 4. Delete from database
    await db.delete(schema.BacktestTrade).where(and(
      eq(schema.BacktestTrade.id, id),
      eq(schema.BacktestTrade.userId, internalUserId),
    ))

    return NextResponse.json({ success: true }, { status: 200 })
  } catch (error) {
    reportApiHandlerError(request, error, 'delete-backtest')
    return NextResponse.json(
      { error: 'Failed to delete backtest' },
      { status: 500 }
    )
  }
}

export const GET = withCanonicalApiResponse(getBacktests)
export const POST = withCanonicalApiResponse(createBacktest)
export const PUT = withCanonicalApiResponse(updateBacktest)
export const DELETE = withCanonicalApiResponse(deleteBacktest)
