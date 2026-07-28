import { logger } from '@/lib/logger';
import * as Sentry from '@sentry/nextjs'
import { NextResponse, NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import * as schema from '@/lib/db/schema'
import { applyRateLimit, feedbackLimiter } from '@/lib/rate-limiter'
import { getResolvedUserIdentitySafe } from '@/server/user-identity'
import { extractIP } from '@/server/geolocation'
import { logServerError } from '@/lib/error-logger'
import { createErrorResponse, createSuccessResponse } from '@/lib/api-response'
import { z } from 'zod'
import { buildFeedbackAttachmentPath } from '@/lib/storage/paths'
import { escapeHtml, sendEmail } from '@/lib/email'

import { getSupabaseAdminClient } from '@/server/supabase-admin'

const MAX_FILE_SIZE = 5 * 1024 * 1024
const MAX_FILES = 3

const ALLOWED_FILE_TYPES: Record<string, string[]> = {
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.gif': ['image/gif'],
  '.webp': ['image/webp'],
  '.pdf': ['application/pdf'],
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
  '.txt': ['text/plain'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
}

const IMAGE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]],
  'application/pdf': [[0x25, 0x50, 0x44, 0x46]],
  'application/msword': [[0xD0, 0xCF, 0x11, 0xE0, 0xA1, 0xB1, 0x1A, 0xE1]],
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': [[0x50, 0x4B, 0x03, 0x04]],
}

const feedbackSchema = z.object({
  category: z.enum(['BUG_REPORT', 'FEATURE_REQUEST', 'GENERAL', 'OTHER']),
  subject: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(5000),
  name: z.string().trim().max(120).optional(),
  email: z.string().trim().email().max(254).optional(),
})

function getFileExtension(fileName: string) {
  const index = fileName.lastIndexOf('.')
  if (index < 0) return ''
  return fileName.slice(index).toLowerCase()
}

async function validateFileSignature(file: File) {
  const signatures = IMAGE_SIGNATURES[file.type]
  if (!signatures) return true

  const bytes = new Uint8Array(await file.slice(0, 12).arrayBuffer())
  const hasPrefix = signatures.some((signature) => signature.every((byte, index) => bytes[index] === byte))
  return file.type === 'image/webp'
    ? hasPrefix && [0x57, 0x45, 0x42, 0x50].every((byte, index) => bytes[index + 8] === byte)
    : hasPrefix
}

function sanitizeOriginalFileName(fileName: string) {
  return fileName.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 180)
}

export async function POST(req: NextRequest) {
  const rl = await applyRateLimit(req, feedbackLimiter)
  if (rl) return rl

  try {
    const formData = await req.formData()
    const identity = await getResolvedUserIdentitySafe()
    const submissionId = crypto.randomUUID()
    const parsed = feedbackSchema.safeParse({
      category: formData.get('category'),
      subject: formData.get('subject'),
      message: formData.get('message'),
      name: formData.get('name') || undefined,
      email: formData.get('email') || undefined,
    })

    if (!parsed.success) {
      return createErrorResponse('Validation failed', 400, parsed.error.flatten(), 'VALIDATION_ERROR')
    }

    const payload = parsed.data
    const attachments: Array<{ name: string; size: number; type: string; url: string }> = []
    const files = formData.getAll('files').filter((file): file is File => file instanceof File && file.size > 0)

    if (files.length > MAX_FILES) {
      return createErrorResponse('Maximum 3 files allowed', 400, undefined, 'TOO_MANY_FILES')
    }

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        return createErrorResponse(`File ${sanitizeOriginalFileName(file.name)} exceeds 5MB limit`, 400, undefined, 'FILE_TOO_LARGE')
      }

      const ext = getFileExtension(file.name)
      const allowedTypes = ALLOWED_FILE_TYPES[ext]
      if (!allowedTypes || !allowedTypes.includes(file.type)) {
        return createErrorResponse('Unsupported attachment file type', 400, undefined, 'UNSUPPORTED_FILE_TYPE')
      }

      if (!(await validateFileSignature(file))) {
        return createErrorResponse('Attachment content does not match its file type', 400, undefined, 'FILE_SIGNATURE_MISMATCH')
      }

      try {
        const supabase = getSupabaseAdminClient()

        const fileName = `${crypto.randomUUID()}${ext}`
        const ownerId = identity?.internalUserId || identity?.authUserId || 'anonymous'
        const filePath = buildFeedbackAttachmentPath({ ownerId, submissionId, fileName })
        const buffer = Buffer.from(await file.arrayBuffer())

        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('feedback-attachments')
          .upload(filePath, buffer, {
            contentType: file.type,
            metadata: { originalName: sanitizeOriginalFileName(file.name) },
          })

        if (uploadError || !uploadData) {
          logger.warn(`Feedback attachment upload failed (type: ${file.type}, size: ${file.size})`)
          return createErrorResponse('Unable to upload feedback attachment', 503, undefined, 'ATTACHMENT_UPLOAD_FAILED')
        }

        attachments.push({
          name: sanitizeOriginalFileName(file.name),
          size: file.size,
          type: file.type,
          url: `storage://feedback-attachments/${uploadData.path}`,
        })
       } catch (error) {
         Sentry.captureException(error, { extra: { route: '/api/v1/feedback', phase: 'attachment-upload' } })
         logger.warn(`Feedback attachment upload failed (type: ${file.type}, size: ${file.size})`)
         return createErrorResponse('Unable to upload feedback attachment', 503, undefined, 'ATTACHMENT_UPLOAD_FAILED')
       }
    }

    const ip = extractIP(req.headers)
    const userAgent = req.headers.get('user-agent') || undefined

    const feedback = (await db.insert(schema.Feedback).values({
      userId: identity?.internalUserId,
      name: payload.name,
      email: payload.email,
      category: payload.category as any,
      subject: payload.subject,
      message: payload.message,
      attachments: attachments.length > 0 ? attachments : undefined,
      ipAddress: ip,
      userAgent,
    }).returning())[0]

    if (!feedback) {
      return createErrorResponse('Failed to create feedback', 500)
    }

    if (payload.email) {
      const safeSubject = escapeHtml(payload.subject)
      void sendEmail({
        to: payload.email,
        subject: `JJI received your ${payload.category.toLowerCase().replaceAll('_', ' ')} feedback`,
        html: `<p>Thanks for taking the time to help improve JJI.</p>
          <p>We received <strong>${safeSubject}</strong>. Your feedback is now in the support queue and we will follow up if a reply is needed.</p>
          <p>- The JJI team</p>`,
      })
    }

    return createSuccessResponse({ id: feedback.id })
  } catch (error: any) {
    await logServerError(error, { url: req.url, source: 'API' })
    return createErrorResponse('Failed to submit feedback', 500)
  }
}
