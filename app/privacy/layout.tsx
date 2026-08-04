import type { Metadata } from 'next'

import { BRAND } from '@/lib/constants/brand'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `How ${BRAND.fullName} handles account, journal, and trading data.`,
}

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children
}
