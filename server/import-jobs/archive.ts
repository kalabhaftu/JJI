import { downloadImportObject } from '@/server/import-object-store'

function toBuffer(data: unknown): Buffer {
  if (Buffer.isBuffer(data)) return data
  if (data instanceof Uint8Array) return Buffer.from(data)
  if (Array.isArray(data)) return Buffer.from(data)
  throw new Error('Invalid import file data')
}

export async function loadImportPayload(
  fileData: unknown,
  fileObjectPath: string | null,
): Promise<Buffer> {
  return fileObjectPath
    ? downloadImportObject(fileObjectPath)
    : toBuffer(fileData)
}
