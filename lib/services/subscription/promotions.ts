import { and, eq } from 'drizzle-orm'

import { db } from '@/lib/db/client'
import { PromoCode, PromoRedemption } from '@/lib/db/schema'

export async function validateAndGetPromo(code: string, userId: string, context: 'signup' | 'renewal' = 'signup') {
  const promo = await db.query.PromoCode.findFirst({ where: eq(PromoCode.code, code.toUpperCase()) })
  if (!promo || !promo.isActive) return null
  if (promo.validUntil && new Date() > promo.validUntil) return null
  if (promo.validFrom && new Date() < promo.validFrom) return null
  if (promo.maxUses && (promo.usesCount ?? 0) >= promo.maxUses) return null
  if (promo.applicability === 'signup_only' && context !== 'signup') return null
  if (promo.applicability === 'renewal_only' && context !== 'renewal') return null


  const existing = await db.query.PromoRedemption.findFirst({
    where: and(eq(PromoRedemption.promoCodeId, promo.id), eq(PromoRedemption.userId, userId)),
  })
  if (existing) return null

  return promo
}

export async function recordPromoRedemption(promoCodeId: string, userId: string) {
  await db.transaction(async (tx) => {
    await tx.insert(PromoRedemption).values({ promoCodeId, userId })
    const promoRecord = await tx.query.PromoCode.findFirst({ where: eq(PromoCode.id, promoCodeId) })
    if (promoRecord) {
      await tx.update(PromoCode).set({ usesCount: (promoRecord.usesCount || 0) + 1 }).where(eq(PromoCode.id, promoCodeId))
    }
  })
}

export async function validatePromoCode(code: string, userId: string) {
  const promo = await validateAndGetPromo(code, userId)
  if (!promo) return null
  return {
    id: promo.id,
    code: promo.code,
    type: promo.type,
    value: promo.value,
    applicability: promo.applicability,
    discountDescription: getDiscountDescription(promo),
  }
}

function getDiscountDescription(promo: { type: string; value: number }) {
  switch (promo.type) {
    case 'percentage_discount': return `${promo.value}% off`
    case 'fixed_discount': return `$${promo.value} off`
    case 'free_months': return `${promo.value} month(s) free`
    case 'lifetime_free': return 'Lifetime free access'
    default: return ''
  }
}

