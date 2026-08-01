import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

function source(path: string): string {
  return readFileSync(resolve(process.cwd(), path), 'utf8')
}

describe('account deletion and toast contracts', () => {
  it('uses the canonical deletion API and keeps retry state after failure', () => {
    const settings = source('app/dashboard/settings/page.tsx')
    expect(settings).toContain("apiRequest('/api/v1/user/delete'")
    expect(settings).not.toContain('/api/auth/delete-account')

    const deletionHandler = settings.slice(settings.indexOf('const handleDeleteAccount'))
    const finallyBlock = deletionHandler.match(/finally\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
    expect(finallyBlock).not.toContain('setIsDeleteModalOpen(false)')
    expect(finallyBlock).not.toContain('setDeleteConfirmText')
  })

  it('keeps one canonical light Sonner provider and removes dead custom toast code', () => {
    const toaster = source('components/safe-toaster.tsx')
    expect(toaster).toContain('theme="light"')
    expect(toaster).toContain('richColors')
    expect(toaster).toContain('closeButton')
    expect(toaster).not.toContain('CustomToast')
    expect(toaster).not.toContain('showToast')
    expect(existsSync(resolve(process.cwd(), 'app/api/auth/delete-account/route.ts'))).toBe(false)
  })
})
