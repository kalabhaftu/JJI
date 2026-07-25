import { describe, expect, it } from 'vitest'
import JSZip from 'jszip'
import { validateImportArchive } from '@/lib/security/import-archive'

describe('import archive resource limits', () => {
  it('accepts a normal JJI backup archive', async () => {
    const zip = await JSZip.loadAsync(await new JSZip().file('data.json', '{"trades":[]}').generateAsync({ type: 'nodebuffer' }))
    expect(() => validateImportArchive(zip)).not.toThrow()
  })

  it('rejects path traversal metadata', async () => {
    const zip = await JSZip.loadAsync(await new JSZip().file('data.json', '{}').generateAsync({ type: 'nodebuffer' }))
    Object.assign(zip.files['data.json']!, { unsafeOriginalName: '../../data.json' })
    expect(() => validateImportArchive(zip)).toThrow(/unsafe file path/)
  })

  it('rejects excessive compression ratios before extraction', async () => {
    const zip = await JSZip.loadAsync(await new JSZip().file('data.json', '{}').generateAsync({ type: 'nodebuffer' }))
    Object.assign(zip.files['data.json']!, { _data: { compressedSize: 1, uncompressedSize: 10_000 } })
    expect(() => validateImportArchive(zip)).toThrow(/compression ratio/)
  })
})
