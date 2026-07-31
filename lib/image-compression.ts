'use client'

import imageCompression from 'browser-image-compression'

export interface CompressionOptions {
  maxSizeMB?: number
  maxWidthOrHeight?: number
  useWebWorker?: boolean
  quality?: number
  format?: 'jpeg' | 'png' | 'webp'
  preserveMetadata?: boolean
}

export interface CompressionResult {
  compressedFile: File
  originalSize: number
  compressedSize: number
  compressionRatio: number
  processingTime: number
}

export class ImageCompressor {
  private static readonly DEFAULT_OPTIONS: CompressionOptions = {
    maxSizeMB: 2, // 2MB max
    maxWidthOrHeight: 1920, // Full HD max
    useWebWorker: true,
    quality: 0.8,
    format: 'jpeg',
    preserveMetadata: false,
  }

  static async compressImage(
    file: File, 
    options: CompressionOptions = {}
  ): Promise<CompressionResult> {
    const startTime = performance.now()
    const mergedOptions = { ...this.DEFAULT_OPTIONS, ...options }
    
    try {
      if (!this.isValidImageType(file)) {
        throw new Error('Invalid file type. Only JPEG, PNG, and WebP are supported.')
      }

      const compressionOptions = {
        maxSizeMB: mergedOptions.maxSizeMB!,
        maxWidthOrHeight: mergedOptions.maxWidthOrHeight!,
        useWebWorker: mergedOptions.useWebWorker!,
        initialQuality: mergedOptions.quality!,
        alwaysKeepResolution: false,
        exifOrientation: 1, // Reset orientation
      }

      const compressedFile = await imageCompression(file, compressionOptions)
      
      const processingTime = performance.now() - startTime
      const compressionRatio = ((file.size - compressedFile.size) / file.size) * 100

      return {
        compressedFile,
        originalSize: file.size,
        compressedSize: compressedFile.size,
        compressionRatio,
        processingTime,
      }
    } catch (error) {
      throw new Error(`Compression failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  static async compressMultipleImages(
    files: File[],
    options: CompressionOptions = {}
  ): Promise<CompressionResult[]> {
    const promises = files.map(file => this.compressImage(file, options))
    return Promise.all(promises)
  }

  static async progressiveCompress(
    file: File,
    targetSizeMB: number = 1
  ): Promise<CompressionResult> {
    const qualityLevels = [0.9, 0.8, 0.7, 0.6, 0.5, 0.4, 0.3]
    
    for (const quality of qualityLevels) {
      const result = await this.compressImage(file, {
        maxSizeMB: targetSizeMB,
        quality,
      })
      
      if (result.compressedSize <= targetSizeMB * 1024 * 1024) {
        return result
      }
    }
    
    return this.compressImage(file, {
      maxSizeMB: targetSizeMB,
      quality: 0.3,
    })
  }

  static async compressForThumbnail(file: File): Promise<CompressionResult> {
    return this.compressImage(file, {
      maxSizeMB: 0.1, // 100KB max
      maxWidthOrHeight: 300,
      quality: 0.7,
      format: 'jpeg',
    })
  }

  static async compressForPreview(file: File): Promise<CompressionResult> {
    return this.compressImage(file, {
      maxSizeMB: 0.5, // 500KB max
      maxWidthOrHeight: 800,
      quality: 0.8,
      format: 'jpeg',
    })
  }

  static async compressForUpload(file: File): Promise<CompressionResult> {
    return this.compressImage(file, {
      maxSizeMB: 2, // 2MB max
      maxWidthOrHeight: 1920,
      quality: 0.85,
      format: 'jpeg',
    })
  }

  private static isValidImageType(file: File): boolean {
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
    return validTypes.includes(file.type.toLowerCase())
  }

  static async getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      const url = URL.createObjectURL(file)
      
      img.onload = () => {
        URL.revokeObjectURL(url)
        resolve({ width: img.naturalWidth, height: img.naturalHeight })
      }
      
      img.onerror = () => {
        URL.revokeObjectURL(url)
        reject(new Error('Failed to load image'))
      }
      
      img.src = url
    })
  }

  static formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes'
    
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  static calculateSavings(originalSize: number, compressedSize: number): {
    percentSaved: number
    bytesReduced: number
    formattedSavings: string
  } {
    const bytesReduced = originalSize - compressedSize
    const percentSaved = (bytesReduced / originalSize) * 100
    
    return {
      percentSaved: Math.round(percentSaved * 100) / 100,
      bytesReduced,
      formattedSavings: this.formatFileSize(bytesReduced),
    }
  }
}

import { useState, useCallback } from 'react'

interface UseImageCompressionReturn {
  compressImage: (file: File, options?: CompressionOptions) => Promise<CompressionResult>
  compressMultiple: (files: File[], options?: CompressionOptions) => Promise<CompressionResult[]>
  isCompressing: boolean
  compressionHistory: CompressionResult[]
  clearHistory: () => void
}

function useImageCompression(): UseImageCompressionReturn {
  const [isCompressing, setIsCompressing] = useState(false)
  const [compressionHistory, setCompressionHistory] = useState<CompressionResult[]>([])

  const compressImage = useCallback(async (
    file: File, 
    options?: CompressionOptions
  ): Promise<CompressionResult> => {
    setIsCompressing(true)
    
    try {
      const result = await ImageCompressor.compressImage(file, options)
      setCompressionHistory(prev => [...prev, result])
      return result
    } finally {
      setIsCompressing(false)
    }
  }, [])

  const compressMultiple = useCallback(async (
    files: File[], 
    options?: CompressionOptions
  ): Promise<CompressionResult[]> => {
    setIsCompressing(true)
    
    try {
      const results = await ImageCompressor.compressMultipleImages(files, options)
      setCompressionHistory(prev => [...prev, ...results])
      return results
    } finally {
      setIsCompressing(false)
    }
  }, [])

  const clearHistory = useCallback(() => {
    setCompressionHistory([])
  }, [])

  return {
    compressImage,
    compressMultiple,
    isCompressing,
    compressionHistory,
    clearHistory,
  }
}

class BatchImageProcessor {
  private queue: Array<{
    file: File
    options: CompressionOptions
    resolve: (result: CompressionResult) => void
    reject: (error: Error) => void
  }> = []
  
  private isProcessing = false
  private readonly maxConcurrent = 3

  async addToQueue(file: File, options?: CompressionOptions): Promise<CompressionResult> {
    return new Promise((resolve, reject) => {
      this.queue.push({
        file,
        options: options || {},
        resolve,
        reject,
      })
      
      this.processQueue()
    })
  }

  private async processQueue() {
    if (this.isProcessing || this.queue.length === 0) return
    
    this.isProcessing = true
    
    while (this.queue.length > 0) {
      const batch = this.queue.splice(0, this.maxConcurrent)
      
      const promises = batch.map(async ({ file, options, resolve, reject }) => {
        try {
          const result = await ImageCompressor.compressImage(file, options)
          resolve(result)
        } catch (error) {
          reject(error instanceof Error ? error : new Error('Compression failed'))
        }
      })
      
      await Promise.allSettled(promises)
    }
    
    this.isProcessing = false
  }

  getQueueStatus(): { pending: number; isProcessing: boolean } {
    return {
      pending: this.queue.length,
      isProcessing: this.isProcessing,
    }
  }

  clearQueue() {
    this.queue.forEach(({ reject }) => {
      reject(new Error('Queue cleared'))
    })
    this.queue = []
  }
}
