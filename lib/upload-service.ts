/**
 * Centralized upload service for handling media uploads
 * Fixes inconsistent bucket handling and provides robust fallbacks
 */

import { createClient } from '@/lib/supabase'
import { STORAGE_BUCKETS } from '@/lib/constants/storage'
import { buildTradeImagePath } from '@/lib/storage/paths'
import logger from '@/lib/logger';

interface UploadResult {
  success: boolean
  url?: string
  error?: string
}

interface UploadOptions {
  userId: string
  folder: string // 'trades', 'notes', 'avatars'
  tradeId?: string
  maxSizeBytes?: number
  allowedTypes?: string[]
}

const DEFAULT_MAX_SIZE = 5 * 1024 * 1024 // 5MB (reduced for security)
const DEFAULT_ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

// Magic bytes (file signatures) for image validation
const IMAGE_SIGNATURES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png': [[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]],
  'image/gif': [[0x47, 0x49, 0x46, 0x38, 0x37, 0x61], [0x47, 0x49, 0x46, 0x38, 0x39, 0x61]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]]
}

class MediaUploadService {
  private supabase = createClient()
  
  async uploadImage(file: File, options: UploadOptions): Promise<UploadResult> {
    try {
      const validation = this.validateFile(file, options)
      if (!validation.valid) {
        return validation.error ? { success: false, error: validation.error } : { success: false }
      }

      const magicBytesValidation = await this.validateMagicBytes(file)
      if (!magicBytesValidation.valid) {
        return magicBytesValidation.error ? { success: false, error: magicBytesValidation.error } : { success: false }
      }

      const supabaseResult = await this.uploadToSupabase(file, options)
      return supabaseResult
      
    } catch (error) {
      return {
        success: false,
        error: 'Upload failed'
      }
    }
  }

  private validateFile(file: File, options: UploadOptions): { valid: boolean; error?: string } {
    const maxSize = options.maxSizeBytes || DEFAULT_MAX_SIZE
    const allowedTypes = options.allowedTypes || DEFAULT_ALLOWED_TYPES

    if (file.size > maxSize) {
      return { 
        valid: false, 
        error: `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB` 
      }
    }

    // Minimum size check (avoid empty files)
    if (file.size < 100) {
      return {
        valid: false,
        error: 'File is too small or empty'
      }
    }

    if (!allowedTypes.includes(file.type)) {
      return { 
        valid: false, 
        error: `File type not supported. Allowed types: ${allowedTypes.join(', ')}` 
      }
    }

    return { valid: true }
  }

  /**
   * Validate file content by checking magic bytes (file signature)
   * This prevents malicious files disguised with wrong extensions
   */
  private async validateMagicBytes(file: File): Promise<{ valid: boolean; error?: string }> {
    try {
      // Read first 12 bytes (enough for all image signatures)
      const arrayBuffer = await file.slice(0, 12).arrayBuffer()
      const bytes = new Uint8Array(arrayBuffer)

      const signatures = IMAGE_SIGNATURES[file.type]
      if (!signatures) return { valid: false, error: 'Unsupported image signature' }

      const hasPrefix = signatures.some(signature =>
        signature.every((byte, index) => bytes[index] === byte)
      )
      const isValid = file.type === 'image/webp'
        ? hasPrefix && [0x57, 0x45, 0x42, 0x50].every((byte, index) => bytes[index + 8] === byte)
        : hasPrefix

      if (!isValid) {
        return {
          valid: false,
          error: 'File content does not match its type. This may be a security risk.'
        }
      }

      return { valid: true }
    } catch {
      return {
        valid: false,
        error: 'Could not validate file content'
      }
    }
  }

  private async uploadToSupabase(file: File, options: UploadOptions): Promise<UploadResult> {
    try {
      const originalName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
      const nameWithoutExt = originalName.substring(0, originalName.lastIndexOf('.')) || originalName
      const fileExtension = file.name.split('.').pop() || 'jpg'
      const timestamp = Date.now()
      const randomId = Math.random().toString(36).substr(2, 6)
      
      // Format: originalname_timestamp_randomid.ext
      // This preserves the original name while ensuring uniqueness
      const fileName = `${nameWithoutExt}_${timestamp}_${randomId}.${fileExtension}`

      const filePath = buildTradeImagePath({
        folder: options.folder,
        userId: options.userId,
        ...(options.tradeId ? { tradeId: options.tradeId } : {}),
        fileName,
      })

      const bucketName = await this.ensureBucket()
      
      const { error: uploadError, data } = await this.supabase.storage
        .from(bucketName)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) {
        return { success: false, error: 'Unable to upload file' }
      }

      const { data: urlData } = this.supabase.storage
        .from(bucketName)
        .getPublicUrl(filePath)

      return { success: true, url: urlData.publicUrl }

    } catch (error) {
      return {
        success: false,
        error: 'Unable to upload file'
      }
    }
  }

  private async ensureBucket(): Promise<string> {
    // Return the known bucket name directly to avoid permission issues with listBuckets
    return STORAGE_BUCKETS.TRADES
  }

  /* WebP Compression - Disabled
   * Enable when experiencing large image sizes
   * Recommended: Max 1920px, 95% quality, WebP format
   * Install: npm install browser-image-compression
   */
  
  // private async compressImage(file: File): Promise<File> {
  //   try {
  //     // Import compression library
  //     const imageCompression = (await import('browser-image-compression')).default
  //     
  //     const options = {
  //       maxWidthOrHeight: 1920,  // Preserves chart details
  //       useWebWorker: true,      // Better performance
  //       fileType: 'image/webp',  // Modern format
  //       initialQuality: 0.95,    // Visually lossless
  //     }
  //     
  //     const compressedFile = await imageCompression(file, options)
  //     
  //     // Log compression results
  //     logger.info(`Compressed: ${(file.size / 1024).toFixed(2)}KB → ${(compressedFile.size / 1024).toFixed(2)}KB`)
  //     
  //     return compressedFile
  //   } catch (error) {
  //     logger.warn('Compression failed, using original:', error)
  //     return file
  //   }
  // }
  
  // To use compression, modify uploadToSupabase:
  // const compressedFile = await this.compressImage(file)
  // Then upload compressedFile instead of file
}

export const uploadService = new MediaUploadService()

