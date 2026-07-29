/**
 * NOWPayments API Client
 * Server-only service for creating invoices and verifying IPN callbacks.
 */

import crypto from 'crypto'
import logger from "@/lib/logger"
import { reportError } from '@/lib/observability/report-error'

const API_BASE_URL = process.env.NOWPAYMENTS_API_BASE_URL || 'https://api.nowpayments.io/v1'
const API_KEY = process.env.NOWPAYMENTS_API_KEY || ''
const IPN_SECRET = process.env.NOWPAYMENTS_IPN_SECRET || ''

function providerError(action: string, status: number) {
  const error = new Error(`Unable to ${action}. Please try again.`)
  reportError(error, {
    surface: 'server',
    operation: 'nowpayments-provider-request',
    tags: { provider: 'nowpayments', action, status },
  })
  return error
}

function getHeaders(): Record<string, string> {
  if (!API_KEY) throw new Error('NOWPAYMENTS_API_KEY is not configured')
  return { 'x-api-key': API_KEY, 'Content-Type': 'application/json' }
}

export interface CreateInvoiceParams {
  price_amount: number
  price_currency: string
  order_id: string
  order_description?: string
  pay_currency?: string
  ipn_callback_url?: string
  success_url?: string
  cancel_url?: string
}

export interface InvoiceResponse {
  id: string
  order_id: string
  price_amount: string
  price_currency: string
  invoice_url: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export type NowPaymentStatus =
  | 'waiting' | 'confirming' | 'confirmed' | 'sending'
  | 'partially_paid' | 'finished' | 'failed' | 'refunded' | 'expired'

export interface PaymentStatusResponse {
  payment_id: number
  invoice_id: number | null
  payment_status: NowPaymentStatus
  price_amount: number
  price_currency: string
  pay_amount: number
  actually_paid: number
  pay_currency: string
  order_id: string
  created_at: string
  updated_at: string
  [key: string]: unknown
}

export interface IpnPayload {
  payment_id: number
  invoice_id: number
  payment_status: NowPaymentStatus
  price_amount: number
  price_currency: string
  pay_amount: number
  actually_paid: number
  pay_currency: string
  order_id: string
  order_description: string
  [key: string]: unknown
}

const NOWPAYMENTS_PENDING_STATUSES: NowPaymentStatus[] = [
  'waiting',
  'confirming',
  'confirmed',
  'sending',
  'partially_paid',
]

function sortObject(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortObject)
  }

  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>)
      .sort()
      .reduce<Record<string, unknown>>((result, key) => {
        result[key] = sortObject((value as Record<string, unknown>)[key])
        return result
      }, {})
  }

  return value
}

export async function createInvoice(params: CreateInvoiceParams): Promise<InvoiceResponse> {
  const body = {
    ...params,
    ipn_callback_url: params.ipn_callback_url || process.env.NOWPAYMENTS_IPN_CALLBACK_URL,
    success_url: params.success_url || process.env.NOWPAYMENTS_SUCCESS_URL,
    cancel_url: params.cancel_url || process.env.NOWPAYMENTS_CANCEL_URL,
  }

  logger.info({ order_id: body.order_id, price_amount: body.price_amount }, '[NOWPayments] Creating invoice')

  const res = await fetch(`${API_BASE_URL}/invoice`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  })

  if (!res.ok) {
    await res.text().catch(() => null)
    throw providerError('create invoice', res.status)
  }

  const data: InvoiceResponse = await res.json()
  logger.info({ id: data.id }, '[NOWPayments] Invoice created')
  return data
}

export async function getMinAmount(currencyFrom: string, currencyTo: string): Promise<number> {
  const query = new URLSearchParams({
    currency_from: currencyFrom,
    currency_to: currencyTo,
  })

  const res = await fetch(`${API_BASE_URL}/min-amount?${query.toString()}`, {
    method: 'GET',
    headers: getHeaders(),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    await res.text().catch(() => null)
    throw providerError('get minimum payment amount', res.status)
  }

  const data = await res.json() as { min_amount?: number | string }
  return Number(data.min_amount || 0)
}

export async function getPaymentStatus(paymentId: string | number): Promise<PaymentStatusResponse> {
  const res = await fetch(`${API_BASE_URL}/payment/${paymentId}`, {
    method: 'GET',
    headers: getHeaders(),
    signal: AbortSignal.timeout(10000),
  })

  if (!res.ok) {
    await res.text().catch(() => null)
    throw providerError('get payment status', res.status)
  }

  return res.json()
}

export function verifyIpnSignature(payload: Record<string, unknown>, signature: string): boolean {
  if (!IPN_SECRET || !signature) {
    logger.warn('[NOWPayments] Missing IPN secret or signature')
    return false
  }

  try {
    const normalizedPayload = JSON.stringify(sortObject(payload))
    const normalizedSignature = signature.trim().toLowerCase()
    const algorithm = normalizedSignature.length === 64 ? 'sha256' : 'sha512'
    const hmac = crypto.createHmac(algorithm, IPN_SECRET)
    hmac.update(normalizedPayload)
    const calculated = hmac.digest('hex')

    if (calculated.length !== normalizedSignature.length) return false

    return crypto.timingSafeEqual(
      Buffer.from(calculated, 'hex'),
      Buffer.from(normalizedSignature, 'hex')
    )
  } catch (error) {
    reportError(error, {
      surface: 'server',
      operation: 'verify-nowpayments-ipn-signature',
      tags: { provider: 'nowpayments' },
    })
    return false
  }
}

function isTerminalStatus(status: NowPaymentStatus): boolean {
  return ['finished', 'failed', 'refunded', 'expired'].includes(status)
}

function isPendingStatus(status: NowPaymentStatus): boolean {
  return NOWPAYMENTS_PENDING_STATUSES.includes(status)
}

export function isSuccessStatus(status: NowPaymentStatus): boolean {
  return status === 'finished'
}

export function isFailureStatus(status: NowPaymentStatus): boolean {
  return ['failed', 'expired', 'refunded'].includes(status)
}
