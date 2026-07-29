import type JSZip from 'jszip'

import type { getSupabaseAdminClient } from '@/server/supabase-admin'

const MAX_IMAGE_BYTES = 12 * 1024 * 1024
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const
const IMAGE_SUFFIXES = ['1', '2', '3', '4', '5', '6', 'preview'] as const
const IMAGE_FIELDS = ['One', 'Two', 'Three', 'Four', 'Five', 'Six'] as const

function findImageFile(
  zipFiles: Record<string, JSZip.JSZipObject>,
  folder: string,
  id: string,
  suffix: string,
) {
  for (const extension of IMAGE_EXTENSIONS) {
    const path = `images/${folder}/${id}_${suffix}.${extension}`
    if (zipFiles[path]) return { file: zipFiles[path], extension }
  }
  return null
}

async function uploadImage(
  zip: JSZip,
  internalUserId: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  zipFolder: string,
  originalId: string,
  suffix: string,
  newId: string,
) {
  const match = findImageFile(
    zip.files,
    zipFolder,
    originalId,
    suffix,
  )
  if (!match) return null

  const buffer = await match.file.async('arraybuffer')
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('A backup image exceeds the size limit')
  }
  const path = `trades/${internalUserId}/${newId}/${suffix}.${match.extension}`
  const { data, error } = await supabase.storage
    .from('trade-images')
    .upload(path, buffer, {
      contentType: `image/${match.extension}`,
      upsert: true,
    })
  if (error || !data) return null
  return `storage://trade-images/${path}`
}

async function uploadEntityImages(
  zip: JSZip,
  internalUserId: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  folder: 'trades' | 'backtest',
  originalId: string,
  newId: string,
) {
  const images: Record<string, string> = {}
  for (const suffix of IMAGE_SUFFIXES) {
    const field = suffix === 'preview'
      ? 'cardPreviewImage'
      : `image${IMAGE_FIELDS[Number.parseInt(suffix, 10) - 1]}`
    const url = await uploadImage(
      zip,
      internalUserId,
      supabase,
      folder,
      originalId,
      suffix,
      newId,
    )
    if (url) images[field] = url
  }
  return images
}

export function uploadTradeImages(
  zip: JSZip,
  internalUserId: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  trade: { originalId?: string; id: string },
  newId: string,
) {
  return uploadEntityImages(
    zip,
    internalUserId,
    supabase,
    'trades',
    trade.originalId || trade.id,
    newId,
  )
}

export function uploadBacktestImages(
  zip: JSZip,
  internalUserId: string,
  supabase: ReturnType<typeof getSupabaseAdminClient>,
  trade: { id: string },
  newId: string,
) {
  return uploadEntityImages(
    zip,
    internalUserId,
    supabase,
    'backtest',
    trade.id,
    newId,
  )
}
