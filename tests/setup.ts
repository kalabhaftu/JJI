import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'
process.env.UPSTASH_REDIS_REST_URL = 'https://test.upstash.io'
process.env.UPSTASH_REDIS_REST_TOKEN = 'test-token'
process.env.TRADOVATE_API_URL = 'https://test.tradovate.com'
process.env.RESEND_API_KEY = 'test-key'


global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}))


vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => ({
    get: vi.fn(),
  }),
  usePathname: () => '/',
}))


vi.mock('@upstash/redis', () => ({
  Redis: class {
    get() { return null }
    set() { return 'OK' }
    del() { return 1 }
    flushdb() { return 'OK' }
  }
}))
