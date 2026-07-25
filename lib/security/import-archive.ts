import type JSZip from 'jszip'

const MAX_ARCHIVE_ENTRIES = 5_000
const MAX_ARCHIVE_EXPANDED_BYTES = 250 * 1024 * 1024
const MAX_ARCHIVE_ENTRY_BYTES = 32 * 1024 * 1024
const MAX_COMPRESSION_RATIO = 200

interface ZipEntryMetadata extends JSZip.JSZipObject {
  unsafeOriginalName?: string
  _data?: { compressedSize?: number; uncompressedSize?: number }
}

export function validateImportArchive(zip: JSZip) {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir) as ZipEntryMetadata[]
  if (entries.length > MAX_ARCHIVE_ENTRIES) throw new Error('Backup contains too many files')

  let expandedBytes = 0
  for (const entry of entries) {
    const originalName = entry.unsafeOriginalName || entry.name
    if (originalName.split(/[\\/]/).includes('..')) throw new Error('Backup contains an unsafe file path')

    const uncompressedSize = entry._data?.uncompressedSize
    const compressedSize = entry._data?.compressedSize
    if (!Number.isFinite(uncompressedSize) || !Number.isFinite(compressedSize)) throw new Error('Backup file metadata is incomplete')
    if (uncompressedSize! > MAX_ARCHIVE_ENTRY_BYTES) throw new Error('A backup file exceeds the expanded size limit')
    if (compressedSize! > 0 && uncompressedSize! / compressedSize! > MAX_COMPRESSION_RATIO) throw new Error('Backup compression ratio exceeds the safety limit')

    expandedBytes += uncompressedSize!
    if (expandedBytes > MAX_ARCHIVE_EXPANDED_BYTES) throw new Error('Backup exceeds the expanded size limit')
  }
}
